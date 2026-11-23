import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import Konva from 'konva'
import { SidebarLeft } from './ui/SidebarLeft'
import { CanvasStage } from './canvas/CanvasStage'
import { EditorPanel } from './ui/EditorPanel'
import { DesktopNavigationRail } from './ui/DesktopNavigationRail'
import { TutorialOverlay } from './ui/TutorialOverlay'
import { FrameGallery } from './canvas/FrameGallery'
import { createInitialState } from './state/store'
import type { EditorState } from './state/store'
import {
  EXACT_VERTICAL_CANVAS,
  FRAME_LAYOUTS,
  type FrameType,
  type UserImage,
} from './types/frame'
import { FRAME_OPTIONS_BY_CATEGORY } from './ui/SidebarLeft'
import {
  DEFAULT_STICKER_HEIGHT,
  DEFAULT_STICKER_WIDTH,
  getCenteredStickerPosition,
  getInitialStickerScale,
  getScaledStickerDimensions,
  loadStickerDimensions,
} from './utils/stickerSizing'
import {
  applyLoadedFontBoxWidths,
  getMinimumTextBoxWidthForMeasuredWidth,
  resolveFontAwareTextBoxWidth,
} from './canvas/textBoxWidth'
import { fontLoader, resolveWithinTimeout } from './utils/fontLoader'
import { getFrameSelectionDecision, hasFrameContent } from './utils/frameChangeFlow'
import {
  getExportExperience,
  shouldPickSaveFileBeforeRender,
  getMobileExportLimits,
  getMobileSaveFallback,
  isShareAbortError,
  shouldShowManualSaveHintImmediately,
} from './utils/exportBehavior'
import { exportStageToBlob } from './utils/stageExport'

type FileSystemWritableFileStream = {
  write: (data: Blob | BufferSource | string) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandle = {
  kind: 'file';
  name: string;
  createWritable: () => Promise<FileSystemWritableFileStream>;
  queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

type SaveFilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: SaveFilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  startIn?: FileSystemFileHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
};

type BoothyLaunchPhoto = {
  assetId: string;
  photoId: string;
};

type BoothyLaunchContext = {
  launchId?: string;
  sessionId?: string;
  photos?: BoothyLaunchPhoto[];
  initiallySelectedAssetIds?: string[];
  completion?: {
    saveUrl?: string;
    cancelUrl?: string;
    statusUrl?: string | null;
    maxPayloadBytes?: number;
  };
};

type BoothySaveRequestPayload = {
  completionStatus: 'saved';
  composition: {
    frameId: string;
    slotAssignments: Array<{
      photoId?: string;
      slotId: string;
    }>;
  };
  idempotencyKey: string;
  launchId: string;
  occurredAt: string;
  renderedImage: {
    kind: 'data-url' | 'binaryUpload' | 'fileToken' | 'appAsset';
    mimeType: string;
    value: string;
    widthPx: number;
    heightPx: number;
  };
  sessionId: string;
  sourceAssetIds: string[];
};

type BoothySaveSucceededMessage = {
  correlationId: string;
  sessionId: string;
  type: 'editor.save_succeeded';
};

type BoothySaveFailedMessage = {
  correlationId: string;
  message: string;
  nextAction?: string;
  sessionId?: string;
  type: 'editor.save_failed';
};

type BoothyImportRequestMessage = {
  correlationId: string;
  sessionId?: string;
  type: 'editor.import_requested';
};

type BoothyImportSelectedMessage = {
  asset: {
    displayLabel: string;
    photoId: string;
    previewDataUrl: string;
  };
  correlationId: string;
  responseId: string;
  sessionId: string;
  type: 'editor.import_selected';
};

type BoothyImportCancelledMessage = {
  correlationId: string;
  responseId: string;
  sessionId: string;
  type: 'editor.import_cancelled';
};

type BoothyImportFailedMessage = {
  code: string;
  correlationId: string;
  message: string;
  nextAction: string;
  responseId: string;
  retryable: boolean;
  sessionId: string;
  type: 'editor.import_failed';
};

type BoothyImportResponseMessage =
  | BoothyImportSelectedMessage
  | BoothyImportCancelledMessage
  | BoothyImportFailedMessage;

type PendingBoothyImportState = {
  correlationId: string;
  slotId: string;
};

type BoothySaveNoticeState = 'idle' | 'saving' | 'saved';

type TextAlign = 'left' | 'center' | 'right';

type CanvasText = {
  id: string;
  text: string;
  x: number;
  y: number;
  boxWidth: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  isBold: boolean;
  isItalic: boolean;
  isVertical: boolean;
  textAlign: TextAlign;
  rotation: number;
  boxWidthBeforeFontLoad?: number;
};

type CanvasSticker = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  tintColor: string | null;
};

const DEFAULT_CANVAS_WIDTH = EXACT_VERTICAL_CANVAS.width;
const DEFAULT_CANVAS_HEIGHT = EXACT_VERTICAL_CANVAS.height;
const BOOTHY_HOST_SAVE_TIMEOUT_MS = 30_000;
const BOOTHY_SAVE_NOTICE_AUTO_CLOSE_MS = 1_500;
const FONT_LOAD_FAILED_MESSAGE = '글씨체를 받지 못해 저장하지 않았습니다. 인터넷 연결을 확인한 뒤 다시 저장해 주세요.';
// 저장할 때 폰트를 기다리는 상한. 넘으면 받기 실패와 같게 저장을 멈춘다.
const SAVE_FONT_WAIT_LIMIT_MS = 30_000;
const SAVE_FILE_FAILED_MESSAGE = '파일 저장 위치를 선택하지 못했습니다. 다운로드로 전환합니다.';

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

function parseLaunchContextFromLocation(): BoothyLaunchContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  const directLaunchContext = url.searchParams.get('launchContext');

  if (directLaunchContext) {
    return parseLaunchContextValue(directLaunchContext);
  }

  const hashIndex = url.hash.indexOf('?');

  if (hashIndex === -1) {
    return null;
  }

  const hashQuery = url.hash.slice(hashIndex + 1);
  const hashSearchParams = new URLSearchParams(hashQuery);
  const hashLaunchContext = hashSearchParams.get('launchContext');

  return hashLaunchContext ? parseLaunchContextValue(hashLaunchContext) : null;
}

function parseLaunchContextValue(rawValue: string): BoothyLaunchContext | null {
  const normalizedValue = rawValue.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    return JSON.parse(normalizedValue) as BoothyLaunchContext;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(normalizedValue)) as BoothyLaunchContext;
    } catch {
      return null;
    }
  }
}

function notifyBoothyHostReady(launchContext: BoothyLaunchContext | null) {
  if (typeof window === 'undefined') {
    return;
  }

  const message = {
    type: 'editor.host_ready',
    sessionId: launchContext?.sessionId?.trim() || undefined,
  };

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }

  if (window.opener) {
    window.opener.postMessage(message, '*');
  }
}

function resolveBoothyHostTargetWindow() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.parent && window.parent !== window) {
    return window.parent;
  }

  if (window.opener) {
    return window.opener;
  }

  return null;
}

async function createImportedFileFromDataUrl(dataUrl: string, photoId: string) {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error('세션 사진 데이터를 편집기로 가져오지 못했습니다.');
  }

  const blob = await response.blob();
  const safePhotoId = photoId.trim() || `session-photo-${Date.now()}`;

  return new File([blob], safePhotoId, {
    type: blob.type || 'image/jpeg',
  });
}

function trySaveToBoothyHost(
  payload: BoothySaveRequestPayload,
): Promise<boolean> {
  if (typeof window === 'undefined' || !window.parent || window.parent === window) {
    return Promise.resolve(false);
  }

  const correlationId = `editor-save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise<boolean>((resolve, reject) => {
    let finished = false;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeoutId);
    };

    const finishWith = (callback: () => void) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      callback();
    };

    const handleMessage = (event: MessageEvent<BoothySaveSucceededMessage | BoothySaveFailedMessage>) => {
      if (event.source && event.source !== window.parent) {
        return;
      }

      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      const response = event.data;

      if (response.correlationId !== correlationId) {
        return;
      }

      if (response.type === 'editor.save_succeeded') {
        finishWith(() => resolve(true));
        return;
      }

      if (response.type === 'editor.save_failed') {
        finishWith(() => reject(new Error(response.message || '세션 저장에 실패했습니다.')));
      }
    };

    const timeoutId = window.setTimeout(() => {
      finishWith(() => resolve(false));
    }, BOOTHY_HOST_SAVE_TIMEOUT_MS);

    window.addEventListener('message', handleMessage);
    window.parent.postMessage(
      {
        correlationId,
        payload,
        sessionId: payload.sessionId,
        type: 'editor.save_requested',
      },
      '*',
    );
  });
}

function buildSlotAssignments(frameType: FrameType, userImages: UserImage[]) {
  const frameLayout = FRAME_LAYOUTS[frameType];
  const imagesBySlotId = new Map(userImages.map((image) => [image.slotId, image] as const));

  return frameLayout.slots.map((slot) => {
    const slottedImage = imagesBySlotId.get(slot.id);

    return {
      slotId: slot.id,
      photoId: slottedImage?.file.name || undefined,
    };
  });
}

function buildSourceAssetIds(input: {
  launchContext: BoothyLaunchContext | null;
  sessionId: string;
  userImages: UserImage[];
}) {
  const launchSelectedAssetIds = (input.launchContext?.initiallySelectedAssetIds ?? [])
    .map((assetId) => assetId.trim())
    .filter(Boolean);

  if (launchSelectedAssetIds.length > 0) {
    return [...new Set(launchSelectedAssetIds)];
  }

  return [...new Set(
    input.userImages.map((image) => `original:${input.sessionId}:${image.file.name}`),
  )];
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('PNG 데이터 URL을 만들지 못했습니다.'));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('PNG 데이터 URL을 만들지 못했습니다.'));
    };

    reader.readAsDataURL(blob);
  });
}

function App() {
  const [editorState, setEditorState] = useState<EditorState>(createInitialState())
  const [canvasMode, setCanvasMode] = useState<'gallery' | 'editor'>('gallery')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [texts, setTexts] = useState<CanvasText[]>([]);
  const [stickers, setStickers] = useState<CanvasSticker[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [pendingFrameChange, setPendingFrameChange] = useState<FrameType | null>(null);
  const [exportMode, setExportMode] = useState<boolean>(false);
  const [isSaveLocked, setSaveLocked] = useState(false);
  const [pendingBoothyImport, setPendingBoothyImport] = useState<PendingBoothyImportState | null>(null);
  const [boothySaveNoticeState, setBoothySaveNoticeState] = useState<BoothySaveNoticeState>('idle');
  const stageRef = useRef<Konva.Stage | null>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const isExportingRef = useRef(false);
  // 저장 중 도착한 Boothy 사진. 저장이 끝난 뒤 그 슬롯에 넣는다.
  const deferredBoothyImportRef = useRef<{ file: File; slotId: string } | null>(null);
  // 모바일 내보내기 오버레이 상태
  const [exportOverlayOpen, setExportOverlayOpen] = useState<boolean>(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportObjectUrl, setExportObjectUrl] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string>("");
  const [exportManualSaveRequired, setExportManualSaveRequired] = useState<boolean>(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => (
    typeof window === 'undefined' ? 1280 : window.innerWidth
  ));
  const [hasCoarsePointer, setHasCoarsePointer] = useState<boolean>(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false
  ));
  const [mobilePanel, setMobilePanel] = useState<'frames' | 'text' | 'sticker' | null>(null);
  const [desktopPanel, setDesktopPanel] = useState<'frames' | 'text' | 'sticker' | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number | null>(0);
  const tutorialRef0 = useRef<HTMLButtonElement>(null);
  const tutorialRef1 = useRef<HTMLButtonElement>(null);
  const tutorialRef2 = useRef<HTMLButtonElement>(null);
  const tutorialRef3 = useRef<HTMLButtonElement>(null);
  const mobileTutorialRef0 = useRef<HTMLButtonElement>(null);
  const mobileTutorialRef1 = useRef<HTMLButtonElement>(null);
  const mobileTutorialRef2 = useRef<HTMLButtonElement>(null);
  const mobileTutorialRef3 = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const coarseMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)')
      : null;

    const updateViewport = () => {
      setViewportWidth(window.innerWidth);
      setHasCoarsePointer(coarseMedia?.matches ?? false);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    coarseMedia?.addEventListener?.('change', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      coarseMedia?.removeEventListener?.('change', updateViewport);
    };
  }, []);

  const isResponsiveMobile = useMemo(() => {
    return viewportWidth <= 768 || (hasCoarsePointer && viewportWidth <= 1024);
  }, [hasCoarsePointer, viewportWidth]);

  const supportsFilePicker = useMemo(() => (
    typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
  ), []);
  const boothyLaunchContext = useMemo(() => parseLaunchContextFromLocation(), []);
  const isBoothyImportBridgeAvailable = useMemo(() => {
    return Boolean(
      boothyLaunchContext?.sessionId?.trim()
      && resolveBoothyHostTargetWindow(),
    );
  }, [boothyLaunchContext]);

  useEffect(() => {
    if (boothySaveNoticeState !== 'saved') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBoothySaveNoticeState('idle');
    }, BOOTHY_SAVE_NOTICE_AUTO_CLOSE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [boothySaveNoticeState]);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      notifyBoothyHostReady(boothyLaunchContext);
    }, 0);

    return () => {
      window.clearTimeout(readyTimer);
    };
  }, [boothyLaunchContext]);

  const handleSelect = (id: string | null) => {
    const selectedImage = id ? editorState.userImages.find((image) => image.id === id) : null;

    setEditorState(prev => ({
      ...prev,
      selection: id,
      selectedSlot: selectedImage?.slotId ?? null,
    }))

    // 텍스트/스티커 선택 상태 업데이트
    if (id && texts.some(text => text.id === id)) {
      setSelectedTextId(id);
      setSelectedStickerId(null);
    } else if (id && stickers.some(sticker => sticker.id === id)) {
      setSelectedStickerId(id);
      setSelectedTextId(null);
    } else {
      setSelectedTextId(null);
      setSelectedStickerId(null);
    }
  }

  const handleSlotSelect = (slotId: string | null) => {
    setEditorState(prev => ({ ...prev, selectedSlot: slotId }))
  }

  const applyFrameChange = (frameType: FrameType) => {
    const newFrameLayout = FRAME_LAYOUTS[frameType];
    const validSlotIds = new Set(newFrameLayout.slots.map(s => s.id));

    setEditorState(prev => {
      // Retain images that fit into the new frame's slots
      const newUserImages = prev.userImages.filter(img => validSlotIds.has(img.slotId));

      return {
        ...prev,
        selectedFrame: frameType,
        userImages: newUserImages,
        selectedSlot: null,
        selection: null,
      };
    });
    // 텍스트 및 스티커는 삭제하지 않고 선택 상태만 초기화합니다.
    setSelectedTextId(null);
    setSelectedStickerId(null);
    setPendingFrameChange(null);
    setMobilePanel(null);
    setDesktopPanel(null);
    setCanvasMode('editor');
  };

  const handleFrameSelect = (rawFrameType: string | null) => {
    const decision = getFrameSelectionDecision({
      rawFrameType,
      selectedFrame: editorState.selectedFrame,
      hasContent: hasFrameContent({
        textCount: texts.length,
        stickerCount: stickers.length,
        userImageCount: editorState.userImages.length,
      }),
    });

    if (decision.kind === 'noop') return;
    if (decision.kind === 'activate-editor') {
      setPendingFrameChange(null);
      setCanvasMode('editor');
      return;
    }
    if (decision.kind === 'confirm') {
      setPendingFrameChange(decision.frameType);
      return;
    }

    applyFrameChange(decision.frameType);
  }

  const handleImageUpload = useCallback((file: File, slotId: string) => {
    console.log('🔥 App.handleImageUpload called with:', file.name, slotId);
    const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const url = URL.createObjectURL(file);
    console.log('🔥 Created image URL:', url);

    const newImage: UserImage = {
      id: imageId,
      file,
      url,
      slotId,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0
    };

    console.log('🔥 Created newImage:', newImage);

    setEditorState(prev => {
      const filteredImages = prev.userImages.filter(img => img.slotId !== slotId);
      const newUserImages = [...filteredImages, newImage];
      console.log('🔥 Updating userImages from', prev.userImages.length, 'to', newUserImages.length);
      return {
        ...prev,
        userImages: newUserImages,
        selection: imageId,
        selectedSlot: slotId,
      };
    });

    setSelectedTextId(null);
    setSelectedStickerId(null);
  }, []);

  const handleBoothyImportRequest = useCallback((slotId: string) => {
    if (!isBoothyImportBridgeAvailable) {
      return false;
    }

    const targetWindow = resolveBoothyHostTargetWindow();

    if (!targetWindow) {
      return false;
    }

    if (pendingBoothyImport) {
      // Recover from a missed host response by retrying the same correlation.
      setPendingBoothyImport({
        correlationId: pendingBoothyImport.correlationId,
        slotId,
      });
      targetWindow.postMessage(
        {
          correlationId: pendingBoothyImport.correlationId,
          sessionId: boothyLaunchContext?.sessionId?.trim() || undefined,
          type: 'editor.import_requested',
        } satisfies BoothyImportRequestMessage,
        '*',
      );
      return true;
    }

    const request: BoothyImportRequestMessage = {
      correlationId: `editor-import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      sessionId: boothyLaunchContext?.sessionId?.trim() || undefined,
      type: 'editor.import_requested',
    };

    setPendingBoothyImport({
      correlationId: request.correlationId,
      slotId,
    });
    targetWindow.postMessage(request, '*');

    return true;
  }, [boothyLaunchContext, isBoothyImportBridgeAvailable, pendingBoothyImport]);

  useEffect(() => {
    if (!pendingBoothyImport) {
      return;
    }

    let isDisposed = false;

    const handleMessage = (event: MessageEvent<BoothyImportResponseMessage>) => {
      const targetWindow = resolveBoothyHostTargetWindow();

      if (event.source && targetWindow && event.source !== targetWindow) {
        return;
      }

      if (!event.data || typeof event.data !== 'object') {
        return;
      }

      if (event.data.correlationId !== pendingBoothyImport.correlationId) {
        return;
      }

      if (event.data.type === 'editor.import_cancelled') {
        setPendingBoothyImport(null);
        return;
      }

      if (event.data.type === 'editor.import_failed') {
        setPendingBoothyImport(null);
        alert(`${event.data.message}\n\n${event.data.nextAction}`);
        return;
      }

      if (event.data.type !== 'editor.import_selected') {
        return;
      }

      void createImportedFileFromDataUrl(
        event.data.asset.previewDataUrl,
        event.data.asset.photoId,
      )
        .then((file) => {
          if (isDisposed) {
            return;
          }

          if (isExportingRef.current) {
            deferredBoothyImportRef.current = { file, slotId: pendingBoothyImport.slotId };
            setPendingBoothyImport(null);
            return;
          }

          handleImageUpload(file, pendingBoothyImport.slotId);
          setPendingBoothyImport(null);
        })
        .catch((error) => {
          if (isDisposed) {
            return;
          }

          setPendingBoothyImport(null);
          alert(
            error instanceof Error && error.message.trim()
              ? error.message
              : '세션 사진을 편집기로 가져오지 못했습니다.',
          );
        });
    };

    window.addEventListener('message', handleMessage);

    return () => {
      isDisposed = true;
      window.removeEventListener('message', handleMessage);
    };
  }, [handleImageUpload, pendingBoothyImport]);


  const handleImageTransform = (imageId: string, transform: Partial<UserImage>) => {
    console.log('[App] onImageTransform', { imageId, transform });
    setEditorState(prev => ({
      ...prev,
      userImages: prev.userImages.map(img =>
        img.id === imageId ? { ...img, ...transform } : img
      )
    }));
  }

  const handleFrameColorChange = (color: string) => {
    setEditorState(prev => ({ ...prev, frameColor: color }))
  }

  const makeSuggestedFilename = useCallback(() => {
    const frameType = editorState.selectedFrame ?? 'preview';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `cut_export_${frameType}_${ts}.png`;
  }, [editorState.selectedFrame]);

  const handleZoomChange = (zoom: number) => {
    setEditorState(prev => ({ ...prev, zoom }))
  }

  useEffect(() => {
    if (!isResponsiveMobile) {
      setMobilePanel(null);
    }
  }, [isResponsiveMobile]);

  const getTextWidth = useCallback((textItem: CanvasText) => {
    if (textItem.isVertical) {
      return Math.max(textItem.fontSize * 0.6, 1);
    }

    if (typeof document === 'undefined') {
      const lines = textItem.text.split('\n');
      const maxLen = Math.max(...lines.map(l => l.length));
      return Math.max(maxLen * textItem.fontSize * 0.6, 1);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const lines = textItem.text.split('\n');
      const maxLen = Math.max(...lines.map(l => l.length));
      return Math.max(maxLen * textItem.fontSize * 0.6, 1);
    }

    ctx.font = `${textItem.isItalic ? 'italic ' : ''}${textItem.isBold ? 'bold ' : ''}${textItem.fontSize}px ${textItem.fontFamily}`;
    const lines = textItem.text.split('\n');
    let maxWidth = 1;
    lines.forEach(line => {
      const text = line.length > 0 ? line : ' ';
      const width = ctx.measureText(text).width;
      if (width > maxWidth) maxWidth = width;
    });

    return maxWidth;
  }, []);

  const getMinimumTextBoxWidth = useCallback((textItem: Pick<CanvasText, 'text' | 'fontSize' | 'fontFamily' | 'isBold' | 'isItalic' | 'isVertical'>) => {
    const measuredWidth = getTextWidth(textItem as CanvasText);
    return getMinimumTextBoxWidthForMeasuredWidth({
      measuredWidth,
      isVertical: textItem.isVertical,
    });
  }, [getTextWidth]);

  // 글자에 쓰인 폰트를 받은 뒤 상자 너비를 실제 폰트로 다시 잰다(캔버스도 다시 그려진다).
  // 받지 못한 폰트 이름을 돌려준다. 그 글자는 받을 때까지 받기 전 기준 폭을 남겨 둔다.
  const loadTextFonts = useCallback(async (fontFamilies: string[]) => {
    const failedFontFamilies = await fontLoader.ensureLoaded(fontFamilies);
    setTexts(prev => applyLoadedFontBoxWidths(prev, {
      isFontReady: fontLoader.isReady,
      getMinimumBoxWidth: getMinimumTextBoxWidth,
    }));
    return failedFontFamilies;
  }, [getMinimumTextBoxWidth]);

  // 저장용: 못 받은 폰트는 한 번 더 받아 보고, 모두 합쳐 상한까지만 기다린다. 넘으면 쓰인 폰트를 모두 못 받은 것으로 본다.
  const loadTextFontsForSave = useCallback((fontFamilies: string[]) => resolveWithinTimeout(
    loadTextFonts(fontFamilies).then((failedFontFamilies) => (
      failedFontFamilies.length > 0 ? loadTextFonts(failedFontFamilies) : failedFontFamilies
    )),
    SAVE_FONT_WAIT_LIMIT_MS,
    fontFamilies,
  ), [loadTextFonts]);

  useEffect(() => {
    const pendingFontFamilies = texts
      .map(text => text.fontFamily)
      .filter(fontFamily => !fontLoader.isReady(fontFamily) && !fontLoader.hasFailed(fontFamily));
    if (pendingFontFamilies.length === 0) return;
    void loadTextFonts(pendingFontFamilies);
  }, [texts, loadTextFonts]);

  const handleTextInsert = (textData: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isBold: boolean;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: TextAlign;
    x: number;
    y: number;
  }) => {
    const newText: CanvasText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...textData,
      boxWidth: 0,
      rotation: 0,
    };
    Object.assign(newText, resolveFontAwareTextBoxWidth({
      previousBoxWidth: 0,
      hasExplicitBoxWidth: false,
      minimumBoxWidth: getMinimumTextBoxWidth(newText),
      didOrientationChange: false,
      isFontReady: fontLoader.isReady(newText.fontFamily),
    }));

    setTexts(prev => [...prev, newText]);
    setSelectedTextId(newText.id); // 새로 삽입한 텍스트를 선택 상태로
  }


  const handleTextMove = (textId: string, x: number, y: number) => {
    setTexts(prev =>
      prev.map(text =>
        text.id === textId ? { ...text, x, y } : text
      )
    );
  }

  const handleTextUpdate = (textId: string, updates: Partial<{
    text: string;
    x: number;
    y: number;
    boxWidth: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isBold: boolean;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: TextAlign;
    rotation: number;
  }>) => {
    setTexts(prev =>
      prev.map(text => {
        if (text.id !== textId) {
          return text;
        }

        const updatedText: CanvasText = { ...text, ...updates };
        const widthRelatedUpdated =
          updates.text !== undefined ||
          updates.boxWidth !== undefined ||
          updates.fontSize !== undefined ||
          updates.fontFamily !== undefined ||
          updates.isBold !== undefined ||
          updates.isItalic !== undefined ||
          updates.isVertical !== undefined;

        if (widthRelatedUpdated) {
          const minimumBoxWidth = getMinimumTextBoxWidth(updatedText);
          const didOrientationChange =
            updates.isVertical !== undefined &&
            updates.isVertical !== text.isVertical &&
            updates.boxWidth === undefined;

          const { boxWidth, boxWidthBeforeFontLoad } = resolveFontAwareTextBoxWidth({
            previousBoxWidth: updatedText.boxWidth,
            boxWidthBeforeFontLoad: text.boxWidthBeforeFontLoad,
            hasExplicitBoxWidth: updates.boxWidth !== undefined,
            minimumBoxWidth,
            didOrientationChange,
            isFontReady: fontLoader.isReady(updatedText.fontFamily),
          });
          updatedText.boxWidth = boxWidth;
          updatedText.boxWidthBeforeFontLoad = boxWidthBeforeFontLoad;
        }

        return updatedText;
      })
    );
  }

  const handleTextDelete = (textId: string) => {
    setTexts(prev => prev.filter(text => text.id !== textId));

    // 삭제된 텍스트가 선택된 상태였다면 선택 해제
    if (selectedTextId === textId) {
      setSelectedTextId(null);
      setEditorState(prev => ({ ...prev, selection: null }));
    }
  }

  const handleStickerInsert = async (src: string) => {
    const { width, height } = await loadStickerDimensions(src, {
      fallbackWidth: DEFAULT_STICKER_WIDTH,
      fallbackHeight: DEFAULT_STICKER_HEIGHT,
    });
    const initialScale = getInitialStickerScale({ width, height });
    const displayDimensions = getScaledStickerDimensions({
      width,
      height,
      scale: initialScale,
    });

    const selectedFrameLayout = editorState.selectedFrame
      ? FRAME_LAYOUTS[editorState.selectedFrame]
      : null;

    const { x, y } = getCenteredStickerPosition({
      canvasWidth: selectedFrameLayout?.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
      canvasHeight: selectedFrameLayout?.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
      stickerWidth: displayDimensions.width,
      stickerHeight: displayDimensions.height,
    });

    const newSticker: CanvasSticker = {
      id: `sticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      src,
      x,
      y,
      width,
      height,
      scaleX: initialScale,
      scaleY: initialScale,
      rotation: 0,
      flipX: false,
      flipY: false,
      tintColor: null,
    };

    setStickers(prev => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setSelectedTextId(null); // Text 선택 해제
    setEditorState(prev => ({ ...prev, selection: newSticker.id }));
  }

  const handleStickerUpdate = (stickerId: string, updates: Partial<CanvasSticker>) => {
    setStickers(prev =>
      prev.map(sticker => {
        if (sticker.id === stickerId) {
          return { ...sticker, ...updates };
        }
        return sticker;
      })
    );
  }

  const handleStickerDelete = (stickerId: string) => {
    setStickers(prev => prev.filter(sticker => sticker.id !== stickerId));

    if (selectedStickerId === stickerId) {
      setSelectedStickerId(null);
      setEditorState(prev => ({ ...prev, selection: null }));
    }
  }

  const handleImageDelete = (imageId: string) => {
    setEditorState(prev => {
      // 삭제할 이미지 찾기
      const imageToDelete = prev.userImages.find(img => img.id === imageId);

      // Blob URL 메모리 해제
      if (imageToDelete?.url) {
        URL.revokeObjectURL(imageToDelete.url);
      }

      // userImages 배열에서 해당 이미지 제거
      const filteredImages = prev.userImages.filter(img => img.id !== imageId);

      return {
        ...prev,
        userImages: filteredImages,
        // 선택 상태 초기화 (선택된 이미지가 삭제된 경우)
        selection: prev.selection === imageId ? null : prev.selection,
        selectedSlot: prev.selectedSlot === imageToDelete?.slotId ? null : prev.selectedSlot,
      };
    });
  }

  const canShareExportFile = useCallback((file: File) => {
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
    };

    if (typeof navigator === 'undefined') return false;
    if (typeof nav.canShare !== 'function') return false;

    try {
      return nav.canShare({ files: [file] });
    } catch {
      return false;
    }
  }, []);

  const getCurrentUserAgent = useCallback(() => (
    typeof navigator === 'undefined' ? '' : navigator.userAgent
  ), []);

  const exportBlobFromStage = useCallback(async ({
    frameType,
    stage,
  }: {
    frameType: FrameType;
    stage: Konva.Stage;
  }) => {
    const mobileExportLimits = isResponsiveMobile
      ? getMobileExportLimits({ userAgent: getCurrentUserAgent() })
      : null;

    return exportStageToBlob({
      frameType,
      stage,
      initialMaxWidthPx: mobileExportLimits?.initialMaxWidthPx,
      fallbackMaxWidthPx: mobileExportLimits?.fallbackMaxWidthPx ?? 3072,
    });
  }, [getCurrentUserAgent, isResponsiveMobile]);

  const isStandaloneDisplayMode = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const nav = navigator as Navigator & { standalone?: boolean };
    const isStandaloneMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;

    return isStandaloneMedia || nav.standalone === true;
  }, []);

  const saveToBoothySession = useCallback(async ({
    blob,
    frameType,
  }: {
    blob: Blob;
    frameType: FrameType;
  }) => {
    const saveUrl = boothyLaunchContext?.completion?.saveUrl?.trim() ?? '';
    const sessionId = boothyLaunchContext?.sessionId?.trim() ?? '';
    const launchId = boothyLaunchContext?.launchId?.trim() ?? '';

    if (!saveUrl || !sessionId || !launchId) {
      return false;
    }

    const sourceAssetIds = buildSourceAssetIds({
      launchContext: boothyLaunchContext,
      sessionId,
      userImages: editorState.userImages,
    });

    if (sourceAssetIds.length === 0) {
      throw new Error('세션 저장에 필요한 사진 정보가 없습니다.');
    }

    const renderedImageDataUrl = await blobToDataUrl(blob);
    const payload: BoothySaveRequestPayload = {
      completionStatus: 'saved',
      composition: {
        frameId: frameType,
        slotAssignments: buildSlotAssignments(frameType, editorState.userImages),
      },
      idempotencyKey: JSON.stringify({
        frameId: frameType,
        launchId,
        sourceAssetIds,
        slotAssignments: buildSlotAssignments(frameType, editorState.userImages),
      }),
      launchId,
      occurredAt: new Date().toISOString(),
      renderedImage: {
        kind: 'data-url',
        mimeType: 'image/png',
        value: renderedImageDataUrl,
        widthPx: FRAME_LAYOUTS[frameType].canvasWidth,
        heightPx: FRAME_LAYOUTS[frameType].canvasHeight,
      },
      sessionId,
      sourceAssetIds,
    };

    const savedViaHostMessage = await trySaveToBoothyHost(payload);

    if (savedViaHostMessage) {
      return true;
    }

    const response = await fetch(saveUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(details || `세션 저장 요청 실패 (${response.status})`);
    }

    return true;
  }, [boothyLaunchContext, editorState.userImages]);

  // 저장하는 동안(저장 위치 창 → 폰트 대기 → 렌더) 편집과 중복 저장을 막는다. 화면 모양은 그대로 둔다.
  const setEditorLocked = useCallback((isLocked: boolean) => {
    if (appContainerRef.current) {
      appContainerRef.current.inert = isLocked;
    }
    // 폰트 창은 앱 밖(document.body)에 떠 있어 inert가 닿지 않으므로 따로 알린다.
    setSaveLocked(isLocked);
  }, []);

  // 내보내기: UI 오버레이 제거 상태에서 고해상도 PNG 추출
  const handleExport = async () => {
    if (isExportingRef.current) return;
    const frameType = editorState.selectedFrame;
    if (!frameType) {
      alert('프레임을 먼저 선택해주세요.');
      return;
    }

    const expectsBoothySessionSave = Boolean(
      boothyLaunchContext?.completion?.saveUrl?.trim()
      && boothyLaunchContext?.sessionId?.trim()
      && boothyLaunchContext?.launchId?.trim(),
    );
    const filename = makeSuggestedFilename();
    const textFontFamilies = texts.map(text => text.fontFamily);

    isExportingRef.current = true;
    setEditorLocked(true);
    let fileHandle: FileSystemFileHandle | null = null;
    let shouldAnnounceDownloadFallback = false;

    try {
      // 저장 위치 창은 클릭 직후에만 열 수 있으므로, 폰트를 기다리거나 PNG를 만들기 전에 연다.
      if (window.showSaveFilePicker && shouldPickSaveFileBeforeRender({
        expectsBoothySessionSave,
        hasFilePicker: supportsFilePicker,
        prefersTouchExperience: isResponsiveMobile,
      })) {
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            excludeAcceptAllOption: true,
            startIn: 'desktop',
            types: [
              {
                description: 'PNG 이미지',
                accept: { 'image/png': ['.png'] },
              },
            ],
          });
        } catch (error) {
          // 손님이 창을 닫으면 아무것도 저장하지 않는다.
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          console.warn('파일 저장 위치 선택 실패', error);
          shouldAnnounceDownloadFallback = true;
        }
      }

      // Stage 준비 및 오버레이 제거
      if (expectsBoothySessionSave) {
        setBoothySaveNoticeState('saving');
      }
      // 폰트를 다 받기 전에 저장해도 고른 폰트가 들어가도록 먼저 받는다. 못 받으면 한 번 더 받아 본다.
      const failedFontFamilies = await loadTextFontsForSave(textFontFamilies);
      // 그래도 못 받거나 상한을 넘기면 대체 폰트로 저장하거나 Boothy로 보내지 않는다.
      if (failedFontFamilies.length > 0) {
        if (expectsBoothySessionSave) {
          setBoothySaveNoticeState('idle');
        }
        alert(FONT_LOAD_FAILED_MESSAGE);
        return;
      }
      setExportMode(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const stage = stageRef.current;
      if (!stage) throw new Error('Stage가 준비되지 않았습니다.');

      const blob = await exportBlobFromStage({ frameType, stage });
      const exportFile = new File([blob], filename, { type: 'image/png' });
      const userAgent = getCurrentUserAgent();
      const isStandalone = isStandaloneDisplayMode();
      const savedToBoothySession = await saveToBoothySession({
        blob,
        frameType,
      });

      if (savedToBoothySession) {
        if (expectsBoothySessionSave) {
          setBoothySaveNoticeState('saved');
        }
        return;
      }

      if (expectsBoothySessionSave) {
        setBoothySaveNoticeState('idle');
      }

      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (error) {
          console.warn('고른 위치에 파일 저장 실패', error);
          shouldAnnounceDownloadFallback = true;
        }
      }

      const exportExperience = getExportExperience({
        hasShareFiles: canShareExportFile(exportFile),
        hasFilePicker: supportsFilePicker,
        prefersTouchExperience: isResponsiveMobile,
      });

      if (exportExperience === 'share-sheet') {
        const url = URL.createObjectURL(blob);
        setExportBlob(blob);
        setExportObjectUrl(url);
        setExportFilename(filename);
        setExportManualSaveRequired(shouldShowManualSaveHintImmediately({
          userAgent,
          isStandalone,
        }));
        setExportOverlayOpen(true);
        return;
      }

      // 파일 시스템 접근 API 미지원 또는 저장 위치 선택·쓰기 실패 시 기본 다운로드로 폴백
      if (shouldAnnounceDownloadFallback) {
        alert(SAVE_FILE_FAILED_MESSAGE);
      }
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
    } catch (e) {
      console.error('Export 실패:', e);
      if (expectsBoothySessionSave) {
        setBoothySaveNoticeState('idle');
      }
      alert(
        e instanceof Error && e.message.trim()
          ? e.message
          : '세션 저장 또는 내보내기에 실패했습니다. 다시 시도해주세요.',
      );
    } finally {
      setExportMode(false);
      setEditorLocked(false);
      isExportingRef.current = false;
      const deferredBoothyImport = deferredBoothyImportRef.current;
      if (deferredBoothyImport) {
        deferredBoothyImportRef.current = null;
        handleImageUpload(deferredBoothyImport.file, deferredBoothyImport.slotId);
      }
    }
  }

  // 모바일: '사진에 저장' 버튼 핸들러 (사용자 제스처 컨텍스트 내)
  const openExportPreview = (previewUrl: string) => {
    const previewWindow = window.open(previewUrl, '_blank', 'noopener,noreferrer');
    if (previewWindow) {
      return true;
    }

    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  };

  const handleMobileSaveToPhotos = async () => {
    if (!exportBlob) return;
    setExportManualSaveRequired(false);

    try {
      const file = new File([exportBlob], exportFilename || 'cut_export.png', { type: 'image/png' });
      const nav = navigator as unknown as { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title: string }) => Promise<void> };
      if (canShareExportFile(file) && 'share' in navigator) {
        await nav.share?.({ files: [file], title: '컷 내보내기' });
        // 공유 완료 후 오버레이 닫기
        handleCloseExportOverlay();
        return;
      }
    } catch (error) {
      if (isShareAbortError(error)) {
        return;
      }

      console.warn('Web Share API 실패 또는 미지원');
    }

    const mobileSaveFallback = getMobileSaveFallback({
      userAgent: getCurrentUserAgent(),
      isStandalone: isStandaloneDisplayMode(),
    });

    if (mobileSaveFallback === 'manual-preview') {
      setExportManualSaveRequired(true);
      return;
    }

    // 폴백 1: 다운로드 시도
    try {
      const url = exportObjectUrl || URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename || 'cut_export.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    } catch {
      console.warn('모바일 다운로드 폴백 실패');
    }

    // 폴백 2: 같은 탭에서 이미지 열기 → 사용자 공유/저장 유도
    try {
      const url = exportObjectUrl || (exportBlob ? URL.createObjectURL(exportBlob) : undefined);
      if (url) {
        openExportPreview(url);
        return;
      }
    } catch {
      console.warn('이미지 열기 폴백 실패');
    }
  };

  const handleCloseExportOverlay = () => {
    setExportOverlayOpen(false);
    if (exportObjectUrl) {
      try {
        URL.revokeObjectURL(exportObjectUrl);
      } catch {
        // 무시
      }
    }
    setExportBlob(null);
    setExportObjectUrl(null);
    setExportFilename("");
    setExportManualSaveRequired(false);
  };

  const activeCategory = selectedCategory || Object.keys(FRAME_OPTIONS_BY_CATEGORY).find(cat =>
    FRAME_OPTIONS_BY_CATEGORY[cat].some(opt => opt.value === editorState.selectedFrame)
  ) || null;

  const availableOptions = activeCategory ? FRAME_OPTIONS_BY_CATEGORY[activeCategory] : [];
  const isMobileEditor = isResponsiveMobile;

  const handleTutorialNext = () => {
    if (tutorialStep === null) return;
    if (tutorialStep >= 3) {
      setTutorialStep(null);
    } else {
      setTutorialStep(tutorialStep + 1);
    }
  };

  const handleTutorialSkip = () => {
    setTutorialStep(null);
  };
  const selectedText = selectedTextId ? texts.find(t => t.id === selectedTextId) : undefined;
  const selectedSticker = selectedStickerId ? stickers.find(s => s.id === selectedStickerId) : undefined;

  const sharedEditorPanelProps = {
    selectedFrame: editorState.selectedFrame,
    selectedText,
    selectedSticker,
    onTextInsert: handleTextInsert,
    onTextUpdate: handleTextUpdate,
    onTextDelete: handleTextDelete,
    onStickerInsert: handleStickerInsert,
    onStickerUpdate: handleStickerUpdate,
    onStickerDelete: handleStickerDelete,
    onExport: handleExport,
    isSaving: isSaveLocked,
  };

  const mainCanvasContent = canvasMode === 'gallery' ? (
    <FrameGallery
      selectedCategory={activeCategory}
      options={availableOptions}
      onSelectFrame={handleFrameSelect}
    />
  ) : (
    <CanvasStage
      template={editorState.template}
      selection={editorState.selection}
      selectedSlot={editorState.selectedSlot}
      zoom={editorState.zoom}
      selectedFrame={editorState.selectedFrame}
      userImages={editorState.userImages}
      frameColor={editorState.frameColor}
      exportMode={exportMode}
      stageRefExternal={stageRef}
      texts={texts}
      stickers={stickers}
      onSelect={handleSelect}
      onSlotSelect={handleSlotSelect}
      onZoomChange={handleZoomChange}
      onImageUpload={handleImageUpload}
      onRequestImageImport={handleBoothyImportRequest}
      onImageTransform={handleImageTransform}
      onFrameColorChange={handleFrameColorChange}
      onTextMove={handleTextMove}
      onTextUpdate={handleTextUpdate}
      onImageDelete={handleImageDelete}
      onTextDelete={handleTextDelete}
      onStickerDelete={handleStickerDelete}
      onStickerUpdate={handleStickerUpdate}
    />
  );

  const mobileSheetTitle = mobilePanel === 'frames'
    ? '프레임 선택'
    : mobilePanel === 'text'
      ? '글씨 편집'
      : '스티커 편집';

  return (
    <div ref={appContainerRef} className="app-container">
      {boothySaveNoticeState !== 'idle' && (
        <div
          aria-live="polite"
          role="status"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.32)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 10000,
          }}
        >
          <div
            className="linear-card"
            style={{
              width: 'min(360px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '999px',
                backgroundColor:
                  boothySaveNoticeState === 'saving'
                    ? '#fef3c7'
                    : '#dcfce7',
                color:
                  boothySaveNoticeState === 'saving'
                    ? '#92400e'
                    : '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {boothySaveNoticeState === 'saving' ? (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2h12" />
                  <path d="M6 22h12" />
                  <path d="M8 2v6a4 4 0 0 0 1.17 2.83L12 13.66l2.83-2.83A4 4 0 0 0 16 8V2" />
                  <path d="M16 22v-6a4 4 0 0 0-1.17-2.83L12 10.34l-2.83 2.83A4 4 0 0 0 8 16v6" />
                </svg>
              ) : (
                <span style={{ fontSize: '24px', fontWeight: 700 }}>✓</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong
                style={{
                  fontSize: '18px',
                  color:
                    boothySaveNoticeState === 'saving'
                      ? '#92400e'
                      : '#15803d',
                }}
              >
                {boothySaveNoticeState === 'saving'
                  ? '편집 사진 저장중..'
                  : '저장 완료'}
              </strong>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: 'var(--linear-secondary-500)',
                }}
              >
                {boothySaveNoticeState === 'saving'
                  ? '편집 결과를 현재 세션에 반영하고 있어요. 잠시만 기다려 주세요.'
                  : '현재 세션 폴더에 저장 완료됐어요. 잠시 후 이 안내는 자동으로 닫혀요.'}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* 튜토리얼 오버레이 */}
      {tutorialStep !== null && (
        <TutorialOverlay
          step={tutorialStep}
          buttonRefs={isMobileEditor
            ? [mobileTutorialRef0, mobileTutorialRef1, mobileTutorialRef2, mobileTutorialRef3]
            : [tutorialRef0, tutorialRef1, tutorialRef2, tutorialRef3]
          }
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
          mobile={isMobileEditor}
        />
      )}

      <div className={`app-main${isMobileEditor ? ' app-main--mobile-editor' : ''}`}>

        {/* 데스크톱: 왼쪽 아이콘 레일 */}
        {!isMobileEditor && (
          <DesktopNavigationRail
            activePanel={desktopPanel}
            onTogglePanel={(panel) => setDesktopPanel((current) => current === panel ? null : panel)}
            onExport={handleExport}
            tutorialStep={tutorialStep}
            frameButtonRef={tutorialRef0}
            textButtonRef={tutorialRef1}
            stickerButtonRef={tutorialRef2}
            saveButtonRef={tutorialRef3}
          />
        )}

        {/* 데스크톱: 확장 가능한 왼쪽 패널 */}
        {!isMobileEditor && desktopPanel && (
          <div
            className="app-desktop-side-panel linear-fade-in"
            style={{
              width: '260px',
              flexShrink: 0,
            }}
          >
            {desktopPanel === 'frames' ? (
              <SidebarLeft
                selectedFrame={editorState.selectedFrame}
                onFrameSelect={handleFrameSelect}
                frameColor={editorState.frameColor}
                onFrameColorChange={handleFrameColorChange}
                canvasMode={canvasMode}
                onCanvasModeChange={setCanvasMode}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            ) : (
              <EditorPanel
                {...sharedEditorPanelProps}
                forcedTab={desktopPanel}
                showActionRail={false}
                showExportButton={false}
              />
            )}
          </div>
        )}

        {/* 캔버스 영역 / 모바일 콘텐츠 */}
        {isMobileEditor ? (
          <>
            <div className="app-mobile-canvas-shell">
              {mainCanvasContent}
            </div>
            {/* 모바일 액션 바 */}
            <div className="app-mobile-toolbar linear-card">
              <button
                ref={mobileTutorialRef0}
                type="button"
                className={`linear-button ${mobilePanel === 'frames' ? 'linear-button--primary' : 'linear-button--secondary'}${tutorialStep === 0 ? ' tutorial-highlight' : ''}`}
                onClick={() => setMobilePanel((prev) => prev === 'frames' ? null : 'frames')}
              >
                프레임
              </button>
              <button
                ref={mobileTutorialRef1}
                type="button"
                className={`linear-button ${mobilePanel === 'text' ? 'linear-button--primary' : 'linear-button--secondary'}${tutorialStep === 1 ? ' tutorial-highlight' : ''}`}
                onClick={() => setMobilePanel((prev) => prev === 'text' ? null : 'text')}
              >
                글씨
              </button>
              <button
                ref={mobileTutorialRef2}
                type="button"
                className={`linear-button ${mobilePanel === 'sticker' ? 'linear-button--primary' : 'linear-button--secondary'}${tutorialStep === 2 ? ' tutorial-highlight' : ''}`}
                onClick={() => setMobilePanel((prev) => prev === 'sticker' ? null : 'sticker')}
              >
                스티커
              </button>
              <button
                ref={mobileTutorialRef3}
                type="button"
                className={`linear-button linear-button--primary${tutorialStep === 3 ? ' tutorial-highlight' : ''}`}
                onClick={handleExport}
              >
                저장
              </button>
            </div>
          </>
        ) : (
          <div className="app-desktop-center-panel">
            {canvasMode === 'editor' && (
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => setCanvasMode('gallery')}
                style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10 }}
              >
                ← 돌아가기
              </button>
            )}
            {mainCanvasContent}
          </div>
        )}
      </div>

      {isMobileEditor && mobilePanel && (
        <div
          className="app-mobile-sheet-backdrop linear-fade-in"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--linear-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9998,
          }}
          onClick={() => setMobilePanel(null)}
        >
          <div
            className="app-mobile-sheet linear-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-mobile-sheet__header">
              <h3>{mobileSheetTitle}</h3>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => setMobilePanel(null)}
              >
                닫기
              </button>
            </div>
            <div className="app-mobile-sheet__content">
              {mobilePanel === 'frames' ? (
                <SidebarLeft
                  selectedFrame={editorState.selectedFrame}
                  onFrameSelect={handleFrameSelect}
                  frameColor={editorState.frameColor}
                  onFrameColorChange={handleFrameColorChange}
                  canvasMode={canvasMode}
                  onCanvasModeChange={setCanvasMode}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
              ) : (
                <EditorPanel
                  {...sharedEditorPanelProps}
                  forcedTab={mobilePanel}
                  showActionRail={false}
                  showExportButton={false}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {pendingFrameChange && (
        <div
          role="dialog"
          aria-modal="true"
          className="linear-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--linear-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => setPendingFrameChange(null)}
        >
          <div
            className="linear-card"
            style={{
              width: 'min(480px, 100%)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: '0',
              border: 'var(--border-width) solid var(--linear-neutral-500)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ margin: 0 }}>프레임 변경 확인</h3>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                프레임을 변경하면 디자인 캔버스의 모든 편집 내용이 초기화됩니다.
                <br />
                {FRAME_LAYOUTS[pendingFrameChange].name} 프레임으로 변경하시겠습니까?
              </p>
              <div className="linear-flex" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="linear-button linear-button--secondary"
                  onClick={() => setPendingFrameChange(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="linear-button linear-button--primary"
                  onClick={() => applyFrameChange(pendingFrameChange)}
                >
                  변경
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모바일: 내보내기 오버레이 (사진에 저장) */}
      {isResponsiveMobile && exportOverlayOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--linear-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999,
          }}
          className="linear-fade-in"
        >
          <div
            className="linear-card"
            style={{ maxWidth: 520, width: '100%', boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>내보내기 완료</h3>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={handleCloseExportOverlay}
              >
                닫기
              </button>
            </div>
            <p style={{ marginBottom: 12 }}>
              {exportManualSaveRequired
                ? '이 브라우저에서는 자동 저장이 불안정할 수 있어요. 아래 미리보기를 길게 눌러 이미지를 저장해 주세요.'
                : '공유 시트로 저장하거나 이미지를 직접 열어 사진 앱에 보관해 주세요.'}
            </p>
            {exportObjectUrl && (
              <img
                src={exportObjectUrl}
                alt="내보낸 이미지 미리보기"
                draggable={false}
                style={{ width: '100%', height: 'auto', borderRadius: 8, marginBottom: 12 }}
              />
            )}
            <div className="linear-flex" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => {
                  const mobileSaveFallback = getMobileSaveFallback({
                    userAgent: getCurrentUserAgent(),
                    isStandalone: isStandaloneDisplayMode(),
                  });

                  if (mobileSaveFallback === 'manual-preview') {
                    setExportManualSaveRequired(true);
                    return;
                  }

                  // 이미지 열기(폴백): 새 탭 미리보기로 현재 편집 화면을 유지
                  if (exportObjectUrl) {
                    openExportPreview(exportObjectUrl);
                  }
                }}
              >
                이미지 열기
              </button>
              <button
                type="button"
                className="linear-button linear-button--primary"
                onClick={handleMobileSaveToPhotos}
              >
                사진에 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

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
import type { CanvasSticker, CanvasText, EditorDocument, TextAlign, TextDeleteRecord } from './state/editorDocument'
import { canUndoTextDelete, collectObjectUrls, collectUrlsToRevoke, hasEditorObject, isSameEditorDocument } from './state/editorDocument'
import type { History } from './state/history'
import {
  canRedo,
  canUndo,
  createHistory,
  getHistoryShortcut,
  HISTORY_CAPTURE_DELAY_MS,
  pushHistory,
  redoHistory,
  undoHistory,
} from './state/history'
import type { PhotoImagesState } from './state/photoLoadState'
import { getPhotoSaveBlockMessage, PHOTO_FAILED_SAVE_MESSAGE, PHOTO_LOADING_SAVE_MESSAGE } from './state/photoLoadState'
import {
  beginPointer,
  createPointerPresence,
  endPointer,
  hasActivePointers,
  resetPointers,
} from './state/pointerPresence'
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
  getMinimumTextBoxWidthForMeasuredWidth,
  resolveTextBoxWidth,
} from './canvas/textBoxWidth'
import { getCategorySelectionOutcome, getFrameSelectionDecision, hasFrameContent } from './utils/frameChangeFlow'
import type { PhotoEdits } from './photo/photoEdits'
import { copyAdjustToAll, createDefaultPhotoEdits } from './photo/photoEdits'
import type { BrushSize, PhotoToolMode } from './photo/photoTool'
import { PHOTO_WORKING_MAX_SIDE } from './photo/photoRender'
import {
  getMobileExportLimits,
  getMobileSaveFallback,
  isShareAbortError,
  shouldShowManualSaveHintImmediately,
} from './utils/exportBehavior'
import { exportStageToBlob } from './utils/stageExport'
import { abandonPendingSegmenters, preloadPointSegmentation, preloadSegmentation, segmentEveryone } from './photo/segmentation'
import {
  createCutoutWorkingCanvas,
  isCancelledAfterPendingInput,
  loadImageElement,
  renderCutoutSticker,
  waitForPaint,
} from './photo/cutoutRender'
import {
  getCutoutConfidence,
  getCutoutWorkingCanvas,
  pruneCutoutCache,
  rememberCutoutConfidence,
  setCutoutWorkingCanvas,
} from './photo/cutoutCache'
import { keepStickerCenter } from './photo/cutoutGeometry'
import { CUTOUT_COPY } from './photo/cutoutCopy'
import type { CutoutChanges, CutoutImagesState } from './photo/cutoutTypes'
import { getInlineStatusView, getNoticeView, splitPhotosByFrame } from './state/appNotice'
import type { AppNotice, InlineStatus, NoticeActionId, NoticeTone } from './state/appNotice'
import type { FocusReturnOrigin } from './state/modalFocus'
import { getFocusReturnCandidates, getWrappedFocusIndex, pickFocusReturnIndex } from './state/modalFocus'
import { countEmptySlots, getCanvasPreparation, getSaveRequestStep, getSaveRoute, makeSaveFilename, resolveMobileEditor, runSaveFlow } from './state/saveFlow'
import type { DecorImagesState } from './state/decorImagesState'
import type { SaveRetry } from './state/saveFlow'

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

const DEFAULT_CANVAS_WIDTH = EXACT_VERTICAL_CANVAS.width;
const DEFAULT_CANVAS_HEIGHT = EXACT_VERTICAL_CANVAS.height;
const BOOTHY_HOST_SAVE_TIMEOUT_MS = 30_000;

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

const NOTICE_TONE_CLASS: Record<NoticeTone, string> = {
  info: '',
  success: 'linear-status--success',
  warning: 'linear-status--warning',
  error: 'linear-status--error',
};

// container의 직계 자식 가운데 keep에 없고 아직 inert가 아닌 것에 inert를 겁니다. 돌려주는 함수는 자기가 건 것만 풉니다.
const setInertOutside = ({ container, keep }: { container: HTMLElement; keep: (Element | null)[] }): (() => void) => {
  const lockedElements = Array.from(container.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement && !keep.includes(element) && !element.inert,
  );
  lockedElements.forEach((element) => { element.inert = true; });
  return () => { lockedElements.forEach((element) => { element.inert = false; }); };
};

const describeFocusCandidate = (element: HTMLElement | null) => {
  if (!element) return { isConnected: false, isDisabled: false, isInert: false, isHidden: true };
  return {
    isConnected: element.isConnected,
    isDisabled: element.matches(':disabled'),
    isInert: element.closest('[inert]') !== null,
    isHidden: element.getClientRects().length === 0,
  };
};

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
  const [exportMode, setExportMode] = useState<boolean>(false);
  const [compareHeld, setCompareHeld] = useState(false);
  const [photoToolMode, setPhotoToolMode] = useState<PhotoToolMode>("none");
  const [brushSize, setBrushSize] = useState<BrushSize>("medium");
  useEffect(() => { setPhotoToolMode("none"); }, [editorState.selection]);
  const currentDocument = useMemo<EditorDocument>(() => ({
    userImages: editorState.userImages,
    texts,
    stickers,
    frameColor: editorState.frameColor,
  }), [editorState.userImages, editorState.frameColor, texts, stickers]);
  const [history, setHistory] = useState<History<EditorDocument>>(() => createHistory(currentDocument));
  const isHistoryPending = !isSameEditorDocument(history.present, currentDocument);
  const [textDeleteRecord, setTextDeleteRecord] = useState<TextDeleteRecord | null>(null); // 글씨 지우기 한 번의 기록(UR-2)
  const isTextDeletedNoticeVisible = canUndoTextDelete({ record: textDeleteRecord, history, currentDocument });
  useEffect(() => {
    // 다른 편집이 기록되거나 글씨를 새로 고르면 안내를 비웁니다. 그 편집을 되돌려도 다시 나타나지 않습니다.
    if (textDeleteRecord !== null && (!isTextDeletedNoticeVisible || selectedTextId !== null)) {
      setTextDeleteRecord(null);
    }
  }, [textDeleteRecord, isTextDeletedNoticeVisible, selectedTextId]);
  const currentDocumentRef = useRef(currentDocument);
  currentDocumentRef.current = currentDocument;
  const trackedObjectUrlsRef = useRef(new Set<string>());
  const [cutoutBusyId, setCutoutBusyId] = useState<string | null>(null);
  const [cutoutError, setCutoutError] = useState<{ targetId: string; message: string } | null>(null);
  const [cutoutImagesState, setCutoutImagesState] = useState<CutoutImagesState>({ kind: "ready" }); // 내 사진 스티커의 현재 PNG가 캔버스에 올라갔는지
  const cutoutImagesStateRef = useRef(cutoutImagesState); // 저장 위치 창을 기다린 뒤에도 지금 값을 읽으려고 둡니다(UX2-1)
  cutoutImagesStateRef.current = cutoutImagesState;
  const cutoutRunRef = useRef(0); // 누끼 작업마다 1 올림. '취소'를 누르면 1 올려 그 작업의 결과를 버림
  const cutoutLockRef = useRef<HTMLDivElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null); // 잠금 중 덮개를 뺀 나머지 자식에 inert를 걸 바깥 div
  const [notice, setNotice] = useState<AppNotice | null>(null); // 확인창 하나(설계 4.5)
  const [inlineStatus, setInlineStatus] = useState<InlineStatus | null>(null); // 상태 줄 하나(설계 4.6)
  const [isExportInFlight, setIsExportInFlight] = useState(false); // 저장 버튼 잠금 표시용
  const [lockedMobileLayout, setLockedMobileLayout] = useState<boolean | null>(null); // 저장하는 동안 고정한 배치. null이면 지금 화면 폭을 따릅니다(UX4-1)
  const retrySaveRef = useRef<SaveRetry<FileSystemFileHandle> | null>(null); // [다시 저장하기]가 쓸 처음 저장의 경로·이름·핸들
  const noticeRef = useRef<HTMLDivElement>(null); // 확인창 배경(app-container의 직계 자식)
  const noticeCardRef = useRef<HTMLDivElement>(null); // 포커스를 받는 카드
  const noticeOpenerRef = useRef<HTMLElement | null>(null); // 확인창이나 저장을 시작한 요소
  const isFocusReturnPendingRef = useRef(false); // 확인창·저장이 끝나면 포커스를 돌려줄지
  const focusReturnOriginRef = useRef<FocusReturnOrigin>('frame-change'); // 안내가 저장에서 시작했는지(UX2-2)
  // 이어지는 안내(빈 칸 → 진행 → 완료) 동안 처음 연 곳과 시작한 곳을 지킵니다. 이미 기억 중이면 바꾸지 않습니다.
  const rememberNoticeOpener = (card: HTMLElement | null, origin: FocusReturnOrigin) => {
    if (isFocusReturnPendingRef.current) return;
    isFocusReturnPendingRef.current = true;
    focusReturnOriginRef.current = origin;
    const activeElement = document.activeElement;
    const isUsableOpener = activeElement instanceof HTMLElement
      && activeElement !== document.body
      && !(card?.contains(activeElement) ?? false);
    noticeOpenerRef.current = isUsableOpener ? activeElement : null;
  };
  const heldBoothyImportRef = useRef<{ file: File; slotId: string } | null>(null); // 잠금 중 도착한 Boothy 사진(마지막 한 건)
  const boothyReleasePendingRef = useRef(false); // 잠금 해제 때 Boothy 사진을 먼저 반영하고, 보류 스티커는 그다음 렌더로 미룸
  const isCutoutLocked = () => cutoutLockRef.current !== null; // 덮개가 떠 있으면 잠금. 옛 클로저의 비동기 콜백에서도 지금 값을 읽음
  const flushHistory = useCallback(() => {
    // 호출 시점의 문서를 고정한다. 같은 배치의 후속 setState가 updater 실행 전에 반영되어
    // 기록 경계가 다음 변경까지 함께 닫히는 일을 막는다.
    const documentToRecord = currentDocumentRef.current;
    setHistory((previous) => pushHistory(previous, documentToRecord, isSameEditorDocument));
  }, []);
  const pointerPresenceRef = useRef(createPointerPresence());
  const [isPointerActive, setIsPointerActive] = useState(false);
  const heldStickerRef = useRef<CanvasSticker[]>([]);
  const lastHeldStickerIdRef = useRef<string | null>(null);
  const photoImagesStateRef = useRef<PhotoImagesState>({ kind: 'ready' });
  const photoImagesSourceRef = useRef<UserImage[] | null>(null);
  const decorImagesStateRef = useRef<DecorImagesState>({ kind: 'ready' }); // 프레임 이미지·색 처리와 일반 스티커의 준비(UX4-2)
  const reportedStageRef = useRef<Konva.Stage | null>(null); // 사진·누끼·프레임·스티커 준비 보고를 마지막으로 낸 캔버스. 새 캔버스의 보고가 오기 전에는 그 캔버스를 준비로 보지 않습니다(UX3-1)
  const handlePhotoImagesStateChange = useCallback((state: PhotoImagesState, userImages: UserImage[], stage: Konva.Stage | null) => {
    photoImagesStateRef.current = state;
    photoImagesSourceRef.current = userImages;
    reportedStageRef.current = stage;
  }, []);
  const handleCutoutImagesStateChange = useCallback((state: CutoutImagesState, stage: Konva.Stage | null) => {
    cutoutImagesStateRef.current = state; // 다음 렌더를 기다리지 않고 이 보고를 바로 읽을 수 있게 합니다
    reportedStageRef.current = stage;
    setCutoutImagesState(state);
  }, []);
  const handleDecorImagesStateChange = useCallback((state: DecorImagesState, stage: Konva.Stage | null) => {
    decorImagesStateRef.current = state;
    reportedStageRef.current = stage;
  }, []);

  useEffect(() => {
    const presence = pointerPresenceRef.current;
    const syncPointerActivity = () => setIsPointerActive(hasActivePointers(presence));
    const onPointerDown = (event: PointerEvent) => {
      if (!beginPointer(presence, event.pointerId, event.isPrimary)) return;
      syncPointerActivity();
      flushHistory();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (!endPointer(presence, event.pointerId)) return;
      syncPointerActivity();
    };
    const onPointerReset = () => {
      if (!resetPointers(presence)) return;
      syncPointerActivity();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onPointerReset();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target;
      const isEditableTarget = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (isEditableTarget) return;
      flushHistory();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
    window.addEventListener("blur", onPointerReset);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerEnd, true);
      window.removeEventListener("pointercancel", onPointerEnd, true);
      window.removeEventListener("blur", onPointerReset);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [flushHistory]);

  useEffect(() => {
    if (isPointerActive) return;
    const timerId = window.setTimeout(flushHistory, HISTORY_CAPTURE_DELAY_MS);
    return () => window.clearTimeout(timerId);
  }, [currentDocument, flushHistory, isPointerActive]);

  useEffect(() => {
    const liveDocuments = [...history.past, history.present, ...history.future, currentDocument];
    liveDocuments.forEach((liveDocument) => {
      collectObjectUrls(liveDocument).forEach((url) => trackedObjectUrlsRef.current.add(url));
    });
    collectUrlsToRevoke(trackedObjectUrlsRef.current, liveDocuments).forEach((url) => {
      URL.revokeObjectURL(url);
      trackedObjectUrlsRef.current.delete(url);
    });
    if (!cutoutBusyId) {
      // 잠긴 동안에는 정리하지 않음. 붙이기 직전에 등록한 새 스티커의 캐시를 아직 문서에 없다고 지우지 않기 위해서
      pruneCutoutCache(new Set(liveDocuments.flatMap((liveDocument) => liveDocument.stickers.map((sticker) => sticker.id))));
    }
  }, [history, currentDocument, cutoutBusyId]);

  useEffect(() => {
    const container = appContainerRef.current;
    const lock = cutoutLockRef.current;
    if (!cutoutBusyId || !container || !lock) return;
    const returnFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null; // 누끼를 시작한 썸네일
    const lockedElements = Array.from(container.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== lock);
    lockedElements.forEach((element) => { element.inert = true; });
    lock.querySelector("button")?.focus();
    const blockLockedKey = (event: KeyboardEvent) => {
      const isCancelKey = lock.contains(event.target as Node) && (event.key === "Enter" || event.key === " ");
      if (isCancelKey) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", blockLockedKey, true);
    window.addEventListener("keyup", blockLockedKey, true);
    return () => {
      window.removeEventListener("keydown", blockLockedKey, true);
      window.removeEventListener("keyup", blockLockedKey, true);
      lockedElements.forEach((element) => { element.inert = false; });
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [cutoutBusyId]);

  // 빠질 사진 장수는 그릴 때마다 지금 사진 목록과 대상 프레임으로 셉니다. 확인창을 연 뒤 늦게 온 사진도 들어갑니다(UX1-2).
  const droppedPhotoCount = notice?.kind === 'frame-change'
    ? splitPhotosByFrame({
      photos: editorState.userImages,
      nextSlotIds: FRAME_LAYOUTS[notice.frameType].slots.map((slot) => slot.id),
    }).dropped.length
    : 0;
  const noticeView = notice ? getNoticeView(notice, droppedPhotoCount) : null;
  const isNoticeOpen = notice !== null;
  const noticeKind = notice?.kind ?? null; // 카드 포커스는 안내가 열리거나 종류가 바뀔 때만 줍니다(UX2-3)
  const inlineStatusView = inlineStatus ? getInlineStatusView(inlineStatus) : null;

  // 확인창 배경: 연 곳 기억, 바깥 inert, Ctrl/Meta 단축키 막기
  useEffect(() => {
    const container = appContainerRef.current;
    const noticeElement = noticeRef.current;
    if (!isNoticeOpen || !container || !noticeElement) return;
    rememberNoticeOpener(noticeElement, 'frame-change');
    // 확인창, 누끼 잠금 덮개, 이미 inert인 요소는 건드리지 않습니다.
    const restoreInert = setInertOutside({ container, keep: [noticeElement, cutoutLockRef.current] });
    const blockShortcutKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', blockShortcutKey, true);
    return () => {
      window.removeEventListener('keydown', blockShortcutKey, true);
      restoreInert();
    };
  }, [isNoticeOpen, cutoutBusyId]);

  // 카드에 포커스. 버튼이 아니라 카드에 줘서 미리 고른 버튼이 없게 합니다. 누끼 잠금이 풀리면 다시 줍니다(UP-5).
  // 같은 안내에서 문장만 바뀔 때(사진 기다림)는 다시 돌지 않아 눌러 둔 버튼의 포커스가 남습니다(UX2-3).
  useEffect(() => {
    if (!noticeKind || cutoutBusyId) return;
    noticeCardRef.current?.focus();
  }, [noticeKind, cutoutBusyId]);

  // 닫힌 뒤 포커스 돌려주기: 연 곳 → 열린 시트의 닫기 버튼 → 캔버스·저장 버튼 가운데 쓸 수 있는 첫 요소
  // (저장에서 시작했으면 저장 버튼이 캔버스보다 앞)
  useEffect(() => {
    if (isNoticeOpen || isExportInFlight || cutoutBusyId || !isFocusReturnPendingRef.current) return;
    const candidates = getFocusReturnCandidates({
      origin: focusReturnOriginRef.current,
      opener: noticeOpenerRef.current,
      sheetCandidates: Array.from(document.querySelectorAll<HTMLElement>('[data-focus-return="sheet-close"]')),
      canvas: document.querySelector<HTMLElement>('[data-focus-return="canvas"]'),
      saves: Array.from(document.querySelectorAll<HTMLElement>('[data-focus-return="save"]')),
    });
    const returnIndex = pickFocusReturnIndex(candidates.map(describeFocusCandidate));
    isFocusReturnPendingRef.current = false;
    noticeOpenerRef.current = null;
    if (returnIndex >= 0) candidates[returnIndex]?.focus();
  }, [isNoticeOpen, isExportInFlight, cutoutBusyId, inlineStatus]);

  const applyEditorDocument = (nextDocument: EditorDocument) => {
    setEditorState((previous) => ({
      ...previous,
      userImages: nextDocument.userImages,
      frameColor: nextDocument.frameColor,
      selection: previous.selection && !hasEditorObject(nextDocument, previous.selection) ? null : previous.selection,
    }));
    setTexts(nextDocument.texts);
    setStickers(nextDocument.stickers);
    if (selectedTextId && !hasEditorObject(nextDocument, selectedTextId)) setSelectedTextId(null);
    if (selectedStickerId && !hasEditorObject(nextDocument, selectedStickerId)) setSelectedStickerId(null);
    setPhotoToolMode("none");
  };

  const handleUndo = () => {
    if (isCutoutLocked()) return;
    const flushed = pushHistory(history, currentDocument, isSameEditorDocument);
    const next = undoHistory(flushed);
    if (next === flushed) return;
    setHistory(next);
    applyEditorDocument(next.present);
  };

  const handleUndoTextDelete = () => {
    // 누르는 순간 다시 봅니다. 맨 위 기록이 그 지우기가 아니면 아무것도 되돌리지 않습니다.
    if (!canUndoTextDelete({ record: textDeleteRecord, history, currentDocument })) return;
    setTextDeleteRecord(null);
    handleUndo();
  };

  const handleRedo = () => {
    if (isCutoutLocked()) return;
    const flushed = pushHistory(history, currentDocument, isSameEditorDocument);
    const next = redoHistory(flushed);
    if (next === flushed) return;
    setHistory(next);
    applyEditorDocument(next.present);
  };

  const [pendingBoothyImport, setPendingBoothyImport] = useState<PendingBoothyImportState | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  // 저장이 끝나기 전에 같은 Stage로 두 번째 저장이 들어와 임시 크기·배율을 복원값으로
  // 기억하지 않도록 동기 ref로 중복 진입을 막는다.
  const exportInFlightRef = useRef(false);
  // 모바일 내보내기 오버레이 상태
  const [exportOverlayOpen, setExportOverlayOpen] = useState<boolean>(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportObjectUrl, setExportObjectUrl] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string>("");
  const [exportManualSaveRequired, setExportManualSaveRequired] = useState<boolean>(false);
  const [exportMissingStickerCount, setExportMissingStickerCount] = useState(0); // 모바일 미리보기에 보여 줄 빠진 스티커 수
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
  const tutorialLayerRef = useRef<HTMLDivElement>(null); // 튜토리얼 덮개(app-container의 직계 자식)
  const tutorialOpenerRef = useRef<HTMLElement | null>(null); // '사용법'을 누른 버튼
  const isTutorialOpen = tutorialStep !== null;

  // 되돌리기·다시 하기 단축키. 내보내는 중과 튜토리얼이 열린 동안은 포커스가 어디 있든 뒤 문서를 바꾸지 않습니다(UX3-4).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (exportMode || isTutorialOpen) return;
      const target = event.target;
      const isEditableTarget = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      const command = getHistoryShortcut({ key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, isEditableTarget });
      if (!command) return;
      event.preventDefault();
      if (command === "undo") handleUndo();
      else handleRedo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportMode, isTutorialOpen, handleUndo, handleRedo]);

  // 튜토리얼이 떠 있는 동안 나머지 화면에 inert를 겁니다. 닫히면 자기가 건 것만 풉니다(설계 6.5).
  useEffect(() => {
    const container = appContainerRef.current;
    const tutorialLayer = tutorialLayerRef.current;
    if (!isTutorialOpen || !container || !tutorialLayer) return;
    return setInertOutside({ container, keep: [tutorialLayer, cutoutLockRef.current] });
  }, [isTutorialOpen]);

  // '사용법'으로 연 튜토리얼이 닫히면 연 곳으로 돌아갑니다. 처음 로드 때 뜬 튜토리얼은 연 곳이 없어 돌려주지 않습니다.
  useEffect(() => {
    if (isTutorialOpen || !tutorialOpenerRef.current) return;
    const candidates = [tutorialOpenerRef.current];
    tutorialOpenerRef.current = null;
    const returnIndex = pickFocusReturnIndex(candidates.map(describeFocusCandidate));
    if (returnIndex >= 0) candidates[returnIndex]?.focus();
  }, [isTutorialOpen]);

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
  // 저장하는 동안에는 화면 폭이 바뀌어도 고정한 배치를 씁니다. 그래야 캔버스가 다시 마운트되지 않습니다(UX4-1).
  const isMobileEditor = resolveMobileEditor({ lockedMobileLayout, isResponsiveMobile });

  const boothyLaunchContext = useMemo(() => parseLaunchContextFromLocation(), []);
  const isBoothyImportBridgeAvailable = useMemo(() => {
    return Boolean(
      boothyLaunchContext?.sessionId?.trim()
      && resolveBoothyHostTargetWindow(),
    );
  }, [boothyLaunchContext]);

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
    if (isCutoutLocked()) return;
    // 새 프레임의 칸에 맞는 사진만 남깁니다. 확인창 안내의 장수와 같은 계산입니다.
    const { kept: nextUserImages } = splitPhotosByFrame({
      photos: editorState.userImages,
      nextSlotIds: FRAME_LAYOUTS[frameType].slots.map((slot) => slot.id),
    });
    const nextDocument: EditorDocument = { userImages: nextUserImages, texts, stickers, frameColor: editorState.frameColor };
    setHistory(createHistory(nextDocument));
    setTextDeleteRecord(null); // 기록을 초기화하므로 지우기 안내도 지웁니다(UR-2)
    setEditorState((previous) => ({
      ...previous,
      selectedFrame: frameType,
      userImages: nextUserImages,
      selectedSlot: null,
      selection: null,
    }));
    // 텍스트 및 스티커는 삭제하지 않고 선택 상태만 초기화합니다.
    setSelectedTextId(null);
    setSelectedStickerId(null);
    setInlineStatus(null);
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
      setCanvasMode('editor');
      return;
    }
    if (decision.kind === 'confirm') {
      setNotice({ kind: 'frame-change', frameType: decision.frameType });
      return;
    }

    applyFrameChange(decision.frameType);
  }

  const handleCategoryPick = (category: string) => {
    const outcome = getCategorySelectionOutcome({ selectedCategory, category });
    setSelectedCategory(outcome.nextCategory);
    setCanvasMode(outcome.nextCanvasMode);
  };

  const handleImageUpload = useCallback((file: File, slotId: string) => {
    const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const url = URL.createObjectURL(file);

    const newImage: UserImage = {
      id: imageId,
      file,
      url,
      slotId,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      edits: createDefaultPhotoEdits()
    };

    setEditorState(prev => {
      const filteredImages = prev.userImages.filter(img => img.slotId !== slotId);
      const newUserImages = [...filteredImages, newImage];
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

    setInlineStatus(null); // 요청을 실제로 보낼 때만 지난 가져오기 실패 줄을 지움

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
        console.warn('오늘 찍은 사진을 불러오지 못했어요', event.data);
        setInlineStatus({ kind: 'import-failed' });
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

          if (isCutoutLocked()) {
            heldBoothyImportRef.current = { file, slotId: pendingBoothyImport.slotId }; // 잠금 중: 마지막 한 건만 보관했다가 풀린 뒤 적용
          } else {
            handleImageUpload(file, pendingBoothyImport.slotId);
          }
          setPendingBoothyImport(null);
        })
        .catch((error) => {
          if (isDisposed) {
            return;
          }

          setPendingBoothyImport(null);
          console.warn('오늘 찍은 사진을 불러오지 못했어요', error);
          setInlineStatus({ kind: 'import-failed' });
        });
    };

    window.addEventListener('message', handleMessage);

    return () => {
      isDisposed = true;
      window.removeEventListener('message', handleMessage);
    };
  }, [handleImageUpload, pendingBoothyImport]);

  useEffect(() => {
    if (cutoutBusyId) return;
    flushHistory(); // 누끼 결과까지를 한 단계로 닫음
    const heldImport = heldBoothyImportRef.current;
    heldBoothyImportRef.current = null;
    if (heldImport) {
      boothyReleasePendingRef.current = true; // 사진이 문서에 들어간 다음 렌더에서 보류 스티커를 붙임(N17)
      handleImageUpload(heldImport.file, heldImport.slotId);
    }
  }, [cutoutBusyId]);

  const handleImageTransform = (imageId: string, transform: Partial<UserImage>) => {
    setEditorState(prev => ({
      ...prev,
      userImages: prev.userImages.map(img =>
        img.id === imageId ? { ...img, ...transform } : img
      )
    }));
  }

  const handlePhotoEditsChange = (imageId: string, edits: PhotoEdits) => {
    setEditorState((previous) => ({
      ...previous,
      userImages: previous.userImages.map((image) => (image.id === imageId ? { ...image, edits } : image)),
    }));
  }

  const handleApplyAdjustToAll = (sourceImageId: string) => {
    setEditorState((previous) => ({ ...previous, userImages: copyAdjustToAll(previous.userImages, sourceImageId) }));
  }

  const photoWorkingMaxSide = isMobileEditor ? PHOTO_WORKING_MAX_SIDE.mobile : PHOTO_WORKING_MAX_SIDE.desktop;

  const handleFrameColorChange = (color: string) => {
    setEditorState(prev => ({ ...prev, frameColor: color }))
  }

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
    newText.boxWidth = getMinimumTextBoxWidth(newText);

    setTexts(prev => [...prev, newText]);
    setSelectedTextId(newText.id); // 새로 삽입한 텍스트를 선택 상태로
    setSelectedStickerId(null);
    setEditorState(prev => ({ ...prev, selection: newText.id, selectedSlot: null }));
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

          updatedText.boxWidth = resolveTextBoxWidth({
            previousBoxWidth: updatedText.boxWidth,
            minimumBoxWidth,
            didOrientationChange,
          });
        }

        return updatedText;
      })
    );
  }

  const handleTextDelete = (textId: string) => {
    setTextDeleteRecord({
      base: pushHistory(history, currentDocument, isSameEditorDocument).present, // 지우기 직전 기록 맨 위(누를 때 flush된 그 객체)
      deleted: { ...currentDocument, texts: currentDocument.texts.filter((text) => text.id !== textId) },
    });
    setTexts(prev => prev.filter(text => text.id !== textId));

    // 삭제된 텍스트가 선택된 상태였다면 선택 해제
    if (selectedTextId === textId) {
      setSelectedTextId(null);
      setEditorState(prev => ({ ...prev, selection: null }));
    }
  }

  const selectInsertedSticker = useCallback((stickerId: string) => {
    setSelectedStickerId(stickerId);
    setSelectedTextId(null); // Text 선택 해제
    setEditorState(prev => ({ ...prev, selection: stickerId }));
  }, []);

  // 포인터를 누르고 있는 동안 끝난 스티커와 누끼 잠금 중 끝난 스티커는 진행 중인 끌기를 끊지 않도록 보류한다.
  const shouldHoldStickerInsert = useCallback(
    () => isCutoutLocked() || hasActivePointers(pointerPresenceRef.current),
    [],
  );

  const buildCenteredSticker = (
    src: string,
    dimensions: { width: number; height: number },
  ): CanvasSticker => {
    const { width, height } = dimensions;
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

    return {
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
  }

  const handleStickerInsert = async (src: string) => {
    const dimensions = await loadStickerDimensions(src, {
      fallbackWidth: DEFAULT_STICKER_WIDTH,
      fallbackHeight: DEFAULT_STICKER_HEIGHT,
    });
    const newSticker = buildCenteredSticker(src, dimensions);

    if (shouldHoldStickerInsert()) {
      heldStickerRef.current.push(newSticker); // 완료 순서대로 보관했다가 잠금·포인터가 풀린 뒤 하나씩 붙임
      return;
    }

    // 치수를 읽는 동안 끝난 앞선 편집과 섞이지 않도록 삽입 직전에 기록 경계를 닫는다.
    flushHistory();
    setStickers((previous) => [...previous, newSticker]);
    selectInsertedSticker(newSticker.id);
  }

  useEffect(() => {
    if (boothyReleasePendingRef.current) {
      // 잠금 해제에서 Boothy 사진을 먼저 반영했다. 그 사진이 문서에 들어간 다음 렌더에서
      // 보류 스티커를 붙여 되돌리기를 한 단계씩 나눈다(N17).
      boothyReleasePendingRef.current = false;
      return;
    }
    if (cutoutBusyId || shouldHoldStickerInsert()) return;
    const nextHeldSticker = heldStickerRef.current[0];
    if (!nextHeldSticker) {
      lastHeldStickerIdRef.current = null;
      return;
    }

    // 앞서 꺼낸 스티커가 아직 문서에 반영되지 않았으면 기다린다. 반영 전에 다음 항목을
    // 꺼내면 두 삽입이 한 기록 단계로 묶여 되돌리기 한 번에 함께 사라진다.
    const lastHeldStickerId = lastHeldStickerIdRef.current;
    if (lastHeldStickerId && !stickers.some((sticker) => sticker.id === lastHeldStickerId)) return;

    heldStickerRef.current.shift(); // 완료 순서대로 하나씩
    lastHeldStickerIdRef.current = nextHeldSticker.id;
    flushHistory(); // 바로 앞 단계(끌기 종료·앞서 붙인 보류 스티커·Boothy 사진)를 닫아 보류 스티커를 별도 단계로 남김
    setStickers((previous) => [...previous, nextHeldSticker]);
    selectInsertedSticker(nextHeldSticker.id);
  }, [cutoutBusyId, currentDocument, flushHistory, isPointerActive, shouldHoldStickerInsert, selectInsertedSticker, stickers]);

  const handleCutoutCancel = () => {
    cutoutRunRef.current += 1; // 진행 중인 작업의 결과를 버림
    abandonPendingSegmenters(); // 아직 준비 중인 모델 요청을 버림. 이미 준비된 모델은 그대로
    setCutoutBusyId(null);
    setCutoutError(null); // 취소 클릭이 오류 예약 뒤에 처리돼도 안내를 남기지 않음
  };

  const handleCutoutCreate = async (imageId: string) => {
    if (cutoutBusyId) return;
    const image = editorState.userImages.find((userImage) => userImage.id === imageId);
    if (!image) return;
    cutoutRunRef.current += 1;
    const runId = cutoutRunRef.current;
    const isCancelled = () => cutoutRunRef.current !== runId;
    let pendingUrl: string | null = null; // 붙이기 전까지 이 함수가 가진 PNG URL
    setCutoutBusyId(imageId);
    setCutoutError(null);
    try {
      await waitForPaint();
      if (isCancelled()) return;
      const source = await loadImageElement(image.url);
      if (isCancelled()) return; // 원본 디코드를 기다리는 동안 취소
      const workingCanvas = createCutoutWorkingCanvas(source, image.edits);
      const confidence = await segmentEveryone(workingCanvas, isCancelled); // 모델을 기다린 뒤 segment() 바로 앞에서도 확인
      if (!confidence || isCancelled()) return; // 취소됐으면 렌더를 시작하지 않음
      const result = await renderCutoutSticker(workingCanvas, confidence, { outline: true, eraseStrokes: [] });
      if (result.kind === "ok") pendingUrl = result.url; // 만들자마자 소유권을 잡음
      // 동기 계산 직후에는 계산 중에 누른 취소 입력이 아직 처리되지 않았을 수 있다.
      // 프레임 경계를 지나 대기 입력을 처리한 뒤 작업 번호를 다시 본다.
      if (await isCancelledAfterPendingInput(isCancelled)) return;
      if (result.kind === "not-found") {
        setCutoutError({ targetId: imageId, message: CUTOUT_COPY.notFound });
        return;
      }
      await loadImageElement(result.url); // 붙이기 전에 PNG를 디코드
      if (await isCancelledAfterPendingInput(isCancelled)) return;
      // 여기부터 finally까지 await가 없습니다. 기록 경계·붙이기·캐시 등록·잠금 해제가 한 배치입니다.
      const newSticker: CanvasSticker = {
        ...buildCenteredSticker(result.url, { width: result.width, height: result.height }),
        cutout: { sourceImageId: imageId, target: { kind: "everyone" }, outline: true, eraseStrokes: [], crop: result.crop, workingSize: result.workingSize },
      };
      // 붙이기 직전에 기록 경계를 닫음. 앞의 변경과 묶이지 않고 누끼만 한 단계가 됨
      flushHistory();
      setStickers((previous) => [...previous, newSticker]);
      pendingUrl = null; // 문서로 넘김. 이제 'URL 해제' effect가 맡음
      selectInsertedSticker(newSticker.id);
      setCutoutWorkingCanvas(newSticker.id, workingCanvas);
      rememberCutoutConfidence(newSticker.id, { kind: "everyone" }, confidence);
      setCutoutImagesState({ kind: "loading" }); // 캔버스가 새 PNG를 올릴 때까지 저장을 막음
      setMobilePanel(null); // 모바일 시트를 닫아 붙은 결과를 바로 보여 줌
    } catch {
      // 동기 추론 실패로 곧바로 catch에 들어온 경우에도 같은 경계를 둔다.
      if (await isCancelledAfterPendingInput(isCancelled)) return;
      setCutoutError({ targetId: imageId, message: CUTOUT_COPY.loadFailed });
    } finally {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl); // 붙이지 못한 URL
      if (!isCancelled()) setCutoutBusyId(null); // 취소했으면 이미 풀렸고, 그 뒤 시작한 새 작업의 잠금은 건드리지 않음
    }
  };

  const handleCutoutRegenerate = async (stickerId: string, changes: CutoutChanges) => {
    if (cutoutBusyId) return;
    const sticker = stickers.find((item) => item.id === stickerId);
    if (!sticker?.cutout) return;
    const workingCanvas = getCutoutWorkingCanvas(stickerId);
    if (!workingCanvas) {
      setCutoutError({ targetId: stickerId, message: CUTOUT_COPY.cacheMissing });
      return;
    }
    const nextSource = { ...sticker.cutout, ...changes };
    cutoutRunRef.current += 1;
    const runId = cutoutRunRef.current;
    const isCancelled = () => cutoutRunRef.current !== runId;
    let pendingUrl: string | null = null; // 바꾸기 전까지 이 함수가 가진 PNG URL
    setCutoutBusyId(stickerId);
    setCutoutError(null);
    try {
      await waitForPaint();
      if (isCancelled()) return;
      const confidence = await getCutoutConfidence(stickerId, nextSource.target, isCancelled); // 모델을 기다린 뒤 segment() 바로 앞에서도 확인
      if (isCancelled()) return; // 취소됐으면 렌더를 시작하지 않음
      if (!confidence) throw new Error("cutout cache missing");
      const result = await renderCutoutSticker(workingCanvas, confidence, { outline: nextSource.outline, eraseStrokes: nextSource.eraseStrokes });
      if (result.kind === "ok") pendingUrl = result.url; // 만들자마자 소유권을 잡음
      // 동기 계산 직후의 취소 입력을 처리한 뒤 결과를 반영한다.
      if (await isCancelledAfterPendingInput(isCancelled)) return;
      if (result.kind === "not-found") {
        setCutoutError({ targetId: stickerId, message: CUTOUT_COPY.notFound });
        return;
      }
      await loadImageElement(result.url); // 바꾸기 전에 PNG를 디코드
      if (await isCancelledAfterPendingInput(isCancelled)) return;
      // 여기부터 finally까지 await가 없습니다. 기록 경계·바꾸기·캐시 등록·잠금 해제가 한 배치입니다.
      flushHistory(); // 바꾸기 직전에 기록 경계를 닫음
      setStickers((previous) => previous.map((item) => (item.id === stickerId
        ? {
          ...item,
          ...keepStickerCenter(item, result.width, result.height),
          src: result.url,
          width: result.width,
          height: result.height,
          cutout: { ...nextSource, crop: result.crop, workingSize: result.workingSize },
        }
        : item)));
      pendingUrl = null; // 문서로 넘김. 이제 Phase 1의 'URL 해제' effect가 맡음
      rememberCutoutConfidence(stickerId, nextSource.target, confidence); // 성공한 작업의 마스크만 캐시에 넣음
      setCutoutImagesState({ kind: "loading" }); // 새 PNG를 캔버스가 올릴 때까지 저장을 막음
    } catch {
      if (await isCancelledAfterPendingInput(isCancelled)) return;
      setCutoutError({ targetId: stickerId, message: CUTOUT_COPY.loadFailed });
    } finally {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl); // 바꾸지 못한 URL
      if (!isCancelled()) setCutoutBusyId(null);
    }
  };

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

  // 저장: 저장 위치 창을 먼저 열고(설계 5.1 A), UI 오버레이를 뺀 고해상도 PNG를 만듭니다.
  const handleExport = async () => {
    if (isCutoutLocked()) return;
    const frameType = editorState.selectedFrame;
    if (!frameType) {
      return;
    }

    // 저장을 기다리지 않는다. 클릭 시점의 문서와 캔버스가 알린 사진 목록이 다르면 아직 최신 상태가 아니다.
    const photoImagesState = photoImagesStateRef.current;
    if (photoImagesSourceRef.current !== editorState.userImages) {
      setInlineStatus({ kind: 'save-blocked', message: PHOTO_LOADING_SAVE_MESSAGE });
      return;
    }
    const photoSaveBlockMessage = getPhotoSaveBlockMessage(photoImagesState);
    if (photoSaveBlockMessage) {
      setInlineStatus({ kind: 'save-blocked', message: photoSaveBlockMessage });
      return;
    }

    if (cutoutImagesState.kind === "loading") {
      setInlineStatus({ kind: 'save-blocked', message: CUTOUT_COPY.exportBlocked });
      return;
    }
    if (!stageRef.current) {
      console.error('저장할 캔버스를 찾지 못했어요');
      // 남은 재시도 정보가 있으면 그 핸들을 그대로 알립니다(결정 F).
      setNotice({ kind: 'save-failed', hasPickedFile: Boolean(retrySaveRef.current?.fileHandle), isWaitingForPhotos: false });
      return;
    }
    let missingStickerCount = 0; // 화면에도 그려지지 않는 누끼 스티커 수. 렌더할 캔버스의 보고로 prepareCanvas에서 셉니다. 저장을 막지 않음

    const expectsBoothySessionSave = Boolean(
      boothyLaunchContext?.completion?.saveUrl?.trim()
      && boothyLaunchContext?.sessionId?.trim()
      && boothyLaunchContext?.launchId?.trim(),
    );

    const isMobileLayoutAtSave = isResponsiveMobile; // 누른 순간의 배치. 저장이 끝날 때까지 이 배치를 지킵니다(UX4-1)

    // 사진 준비 확인을 통과한 저장만 Stage를 사용한다. Stage를 만지기 전에 동기 ref로
    // 중복 진입을 막아, 두 번째 저장이 첫 저장의 임시 크기·배율을 복원값으로 기억하지 않게 한다.
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;

    try {
      setIsExportInFlight(true);
      setLockedMobileLayout(isMobileLayoutAtSave); // 위치 창을 열기 전에 고정합니다. 풀기는 아래 finally 한 곳입니다
      setInlineStatus(null);
      const route = getSaveRoute({
        expectsBoothySessionSave,
        isMobileLayout: isMobileLayoutAtSave,
        hasFilePicker: typeof window.showSaveFilePicker === 'function',
      });
      // 여기부터 pickFile까지 await가 없어야 클릭의 사용자 활성화 안에서 창이 열립니다.
      // retrySaveRef는 렌더를 거친 저장이 끝날 때까지 비우지 않습니다(결정 F). 그 안의 경로·이름·핸들이 지금 route와 이름보다 앞섭니다.
      const result = await runSaveFlow(
        { route, filename: makeSaveFilename(new Date()), retry: retrySaveRef.current },
        {
          pickFile: (suggestedName) => window.showSaveFilePicker!({
            suggestedName,
            excludeAcceptAllOption: true,
            startIn: 'desktop',
            types: [{ description: 'PNG 이미지', accept: { 'image/png': ['.png'] } }],
          }),
          showProgress: () => setNotice({ kind: 'save-progress' }),
          // 확인은 기다린 뒤 읽은 캔버스 하나에만 합니다(UX3-1). 렌더도 그 캔버스로 합니다.
          prepareCanvas: async () => {
            setCompareHeld(false);
            setPhotoToolMode("none");
            setExportMode(true);
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            const stage = stageRef.current; // 기다린 뒤 한 번만 읽습니다. 이 캔버스를 확인하고 이 캔버스로 렌더합니다
            const preparation = readCanvasPreparation(stage);
            if (preparation.kind === 'ready') {
              // 준비 확인이 본 보고가 이 캔버스의 보고이므로, 누락 안내의 장수도 그 보고에서 셉니다(UX4-2).
              const renderedCutoutState = cutoutImagesStateRef.current;
              missingStickerCount = renderedCutoutState.kind === "failed" ? renderedCutoutState.stickerIds.length : 0;
            }
            return preparation;
          },
          render: (stage) => exportBlobFromStage({ frameType, stage }),
          saveToBoothy: (blob) => saveToBoothySession({ blob, frameType }),
          openWritable: (fileHandle) => fileHandle.createWritable(),
          download: (blob, name) => {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
          },
          openShareSheet: (blob, name) => {
            const url = URL.createObjectURL(blob);
            setExportBlob(blob);
            setExportObjectUrl(url);
            setExportFilename(name);
            setExportManualSaveRequired(shouldShowManualSaveHintImmediately({
              userAgent: getCurrentUserAgent(),
              isStandalone: isStandaloneDisplayMode(),
            }));
            setExportMissingStickerCount(missingStickerCount);
            setExportOverlayOpen(true);
          },
          warn: (message, error) => console.warn(message, error),
        },
      );

      if (result.kind === 'photos-not-ready') {
        // 렌더·쓰기 전에 멈췄습니다. 고른 경로·이름·핸들을 남기고 기존 사진 기다림 안내로 [다시 저장하기]를 보입니다(결정 F).
        retrySaveRef.current = result.retry;
        setNotice({ kind: 'save-failed', hasPickedFile: result.retry.fileHandle !== null, isWaitingForPhotos: true });
        return;
      }
      if (result.kind === 'photos-failed') {
        // 기다려도 풀리지 않는 사진 실패입니다. 고른 경로·이름·핸들은 남기고 저장 전에 막을 때와 같은 사진 실패 안내를 보입니다.
        retrySaveRef.current = result.retry;
        setNotice(null);
        setInlineStatus({ kind: 'save-blocked', message: PHOTO_FAILED_SAVE_MESSAGE });
        return;
      }
      if (result.kind === 'failed') {
        console.error('사진 저장 실패', result.error);
        retrySaveRef.current = result.retry;
        setNotice({ kind: 'save-failed', hasPickedFile: result.retry.fileHandle !== null, isWaitingForPhotos: false });
        return;
      }
      retrySaveRef.current = null; // 렌더를 거친 저장이 끝났습니다(성공, 다운로드, 공유 화면). 취소는 retry가 null일 때만 생깁니다
      if (result.kind === 'cancelled') {
        setNotice(null);
        setInlineStatus({ kind: 'save-cancelled' });
        return;
      }
      if (result.kind === 'share-sheet') {
        setNotice(null);
        return;
      }
      setNotice({ kind: 'save-done', location: result.location, missingStickerCount });
    } catch (error) {
      console.error('사진 저장 실패', error);
      // 예상 밖 오류에도 남은 핸들은 지우지 않습니다. 다시 저장하기가 같은 파일에 씁니다.
      setNotice({ kind: 'save-failed', hasPickedFile: Boolean(retrySaveRef.current?.fileHandle), isWaitingForPhotos: false });
    } finally {
      exportInFlightRef.current = false;
      setExportMode(false);
      setIsExportInFlight(false);
      setLockedMobileLayout(null); // 완료·취소·실패·대기·예외 어느 끝에서든 풉니다. 풀리면 지금 화면 폭의 배치로 돌아갑니다
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
    setExportMissingStickerCount(0);
  };

  const handleNoticeAction = (actionId: NoticeActionId) => {
    const currentNotice = notice;
    if (actionId === 'retry-save' && currentNotice?.kind === 'save-failed' && isSaveWaitingForImages()) {
      // 사진이나 누끼를 아직 불러오는 중입니다. 실패 안내와 [다시 저장하기]를 그대로 두고 기다림 문장만 더합니다(결정 F).
      setNotice({ ...currentNotice, isWaitingForPhotos: true });
      return;
    }
    setNotice(null);
    if (actionId === 'change-frame' && currentNotice?.kind === 'frame-change') {
      applyFrameChange(currentNotice.frameType);
      return;
    }
    if (actionId === 'save-anyway' || actionId === 'retry-save') {
      // 확인창 버튼 클릭도 사용자 활성화를 주므로 저장 위치 창을 열 수 있습니다. retry-save는 retrySaveRef를 그대로 씁니다.
      void handleExport();
    }
    // 'close'는 닫기만 합니다. retrySaveRef는 비우지 않습니다(결정 F, 설계 4.5).
  };

  const handleNoticeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!noticeView) return;
    if (event.key === 'Escape') {
      if (!noticeView.closeActionId) return;
      event.preventDefault();
      event.stopPropagation();
      handleNoticeAction(noticeView.closeActionId);
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const focusMove = getWrappedFocusIndex({
      focusableCount: buttons.length,
      activeIndex: buttons.findIndex((button) => button === document.activeElement),
      isShiftKey: event.shiftKey,
    });
    if (focusMove.kind === 'native') return;
    event.preventDefault();
    if (focusMove.kind === 'move') buttons[focusMove.index].focus();
  };

  const handleSaveRequest = () => {
    if (cutoutBusyId) return;
    if (exportInFlightRef.current) return;
    const frameType = editorState.selectedFrame;
    if (!frameType) return;
    rememberNoticeOpener(null, 'save'); // 저장이 끝나면 이 버튼으로 포커스를 돌려줍니다(잠금 중 포커스를 잃어도)
    setInlineStatus(null);
    // retrySaveRef는 비우지 않습니다(결정 F). 남은 재시도 정보가 있으면 handleExport가 그 경로·이름·핸들을 씁니다
    // 막힐 저장은 빈 칸 확인보다 먼저 첫 클릭에서 알립니다(UP-9). handleExport가 같은 검사를 다시 합니다.
    const saveBlockedMessage = photoImagesSourceRef.current !== editorState.userImages
      ? PHOTO_LOADING_SAVE_MESSAGE
      : getPhotoSaveBlockMessage(photoImagesStateRef.current)
        ?? (cutoutImagesState.kind === "loading" ? CUTOUT_COPY.exportBlocked : null);
    const saveRequestStep = getSaveRequestStep({
      saveBlockedMessage,
      emptySlotCount: countEmptySlots({
        slotIds: FRAME_LAYOUTS[frameType].slots.map((slot) => slot.id),
        photoSlotIds: editorState.userImages.map((image) => image.slotId),
      }),
    });
    if (saveRequestStep.kind === 'blocked') {
      setInlineStatus({ kind: 'save-blocked', message: saveRequestStep.message });
      return;
    }
    if (saveRequestStep.kind === 'confirm-empty-slots') {
      setNotice({ kind: 'empty-slots', emptySlotCount: saveRequestStep.emptySlotCount });
      return;
    }
    void handleExport();
  };

  // 렌더할 캔버스와 그 캔버스가 낸 사진·누끼·프레임·스티커 준비 보고로 저장해도 되는지 한 곳에서 판단합니다(UX3-1·UX3-3·UX4-2).
  // ref만 읽어서 저장 위치 창을 기다린 뒤 옛 렌더의 클로저에서 불러도 지금 값을 봅니다.
  const readCanvasPreparation = (stage: Konva.Stage | null) => getCanvasPreparation({
    stage,
    reportedStage: reportedStageRef.current,
    reportedUserImages: photoImagesSourceRef.current,
    documentUserImages: currentDocumentRef.current.userImages,
    photoImagesState: photoImagesStateRef.current,
    cutoutImagesState: cutoutImagesStateRef.current,
    decorImagesState: decorImagesStateRef.current,
  });

  // 다시 저장하기를 눌렀을 때 기다리면 풀리는 막힘인지 봅니다(결정 F). 같은 판단을 씁니다.
  // 사진 실패(failed)는 기다려도 풀리지 않으므로 넣지 않습니다. 그때는 안내를 닫고 handleExport가 상태 줄 save-blocked를 보입니다.
  const isSaveWaitingForImages = () => readCanvasPreparation(stageRef.current).kind === 'waiting';

  const activeCategory = selectedCategory || Object.keys(FRAME_OPTIONS_BY_CATEGORY).find(cat =>
    FRAME_OPTIONS_BY_CATEGORY[cat].some(opt => opt.value === editorState.selectedFrame)
  ) || null;

  const availableOptions = activeCategory ? FRAME_OPTIONS_BY_CATEGORY[activeCategory] : [];

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

  const handleTutorialOpen = () => {
    const activeElement = document.activeElement;
    tutorialOpenerRef.current = activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null;
    setMobilePanel(null);
    setTutorialStep(0);
  };
  const selectedText = selectedTextId ? texts.find(t => t.id === selectedTextId) : undefined;
  const selectedSticker = selectedStickerId ? stickers.find(s => s.id === selectedStickerId) : undefined;

  const cutoutCandidateImages = editorState.selectedFrame
    ? FRAME_LAYOUTS[editorState.selectedFrame].slots
        .map((slot) => editorState.userImages.find((image) => image.slotId === slot.id))
        .filter((image): image is UserImage => Boolean(image))
        .map((image) => ({ id: image.id, url: image.url }))
    : [];

  const sharedEditorPanelProps = {
    selectedFrame: editorState.selectedFrame,
    selectedText,
    selectedSticker,
    onTextInsert: handleTextInsert,
    onTextUpdate: handleTextUpdate,
    onTextDelete: handleTextDelete,
    isTextDeletedNoticeVisible,
    onUndoTextDelete: handleUndoTextDelete,
    onStickerInsert: handleStickerInsert,
    onStickerUpdate: handleStickerUpdate,
    onStickerDelete: handleStickerDelete,
    onExport: handleSaveRequest,
    cutoutSection: {
      images: cutoutCandidateImages,
      errorMessage: cutoutError && cutoutCandidateImages.some((image) => image.id === cutoutError.targetId) ? cutoutError.message : null,
      onCreate: (imageId: string) => { void handleCutoutCreate(imageId); },
      onPreload: () => { void preloadSegmentation().catch(() => undefined); },
    },
  };

  const mainCanvasContent = canvasMode === 'gallery' ? (
    <FrameGallery
      selectedCategory={activeCategory}
      categories={Object.keys(FRAME_OPTIONS_BY_CATEGORY)}
      options={availableOptions}
      onSelectFrame={handleFrameSelect}
      onSelectCategory={handleCategoryPick}
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
      historyControls={{
        canUndo: canUndo(history) || isHistoryPending,
        canRedo: canRedo(history) && !isHistoryPending,
        onUndo: handleUndo,
        onRedo: handleRedo,
      }}
      photoEdit={{
        workingMaxSide: photoWorkingMaxSide,
        compareHeld,
        onCompareHeldChange: setCompareHeld,
        onEditsChange: handlePhotoEditsChange,
        onApplyAdjustToAll: handleApplyAdjustToAll,
        toolMode: photoToolMode,
        onToolModeChange: setPhotoToolMode,
        brushSize,
        onBrushSizeChange: setBrushSize,
      }}
      exportMode={exportMode}
      isEditLocked={cutoutBusyId !== null}
      cutoutEdit={{
        errorMessage: cutoutError && cutoutError.targetId === editorState.selection ? cutoutError.message : null,
        onRegenerate: (stickerId: string, changes: CutoutChanges) => { void handleCutoutRegenerate(stickerId, changes); },
        onPreloadPointModel: () => { void preloadPointSegmentation().catch(() => undefined); },
      }}
      stageRefExternal={stageRef}
      texts={texts}
      stickers={stickers}
      onPhotoImagesStateChange={handlePhotoImagesStateChange}
      onCutoutImagesStateChange={handleCutoutImagesStateChange}
      onDecorImagesStateChange={handleDecorImagesStateChange}
      onSelect={handleSelect}
      onSlotSelect={handleSlotSelect}
      onZoomChange={handleZoomChange}
      onImageUpload={handleImageUpload}
      onRequestImageImport={isBoothyImportBridgeAvailable ? handleBoothyImportRequest : undefined}
      onOpenFrameGallery={() => setCanvasMode('gallery')}
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
      {cutoutBusyId && (
        <div
          ref={cutoutLockRef}
          aria-live="polite"
          role="status"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 10000 }}
        >
          <div className="linear-card" style={{ width: 'min(360px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <p style={{ margin: 0 }}>{CUTOUT_COPY.creating}</p>
            <button type="button" className="linear-button linear-button--secondary" onClick={handleCutoutCancel}>
              {CUTOUT_COPY.cancel}
            </button>
          </div>
        </div>
      )}
      {/* 튜토리얼 오버레이 */}
      <div ref={tutorialLayerRef}>
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
      </div>

      <div className={`app-main${isMobileEditor ? ' app-main--mobile-editor' : ''}`}>

        {/* 데스크톱: 왼쪽 아이콘 레일 */}
        {!isMobileEditor && (
          <DesktopNavigationRail
            activePanel={desktopPanel}
            onTogglePanel={(panel) => setDesktopPanel((current) => current === panel ? null : panel)}
            onExport={handleSaveRequest}
            onOpenTutorial={handleTutorialOpen}
            isSaveDisabled={!editorState.selectedFrame || isExportInFlight}
            saveDisabledReason={editorState.selectedFrame ? undefined : '먼저 프레임을 골라 주세요'}
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
                onClick={handleSaveRequest}
                disabled={!editorState.selectedFrame || isExportInFlight}
                title={editorState.selectedFrame ? undefined : '먼저 프레임을 골라 주세요'}
                style={{ opacity: !editorState.selectedFrame || isExportInFlight ? 0.5 : 1 }}
                data-focus-return="save"
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
                ← 프레임 다시 고르기
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
              <div className="linear-flex" style={{ gap: '8px' }}>
                <button
                  type="button"
                  className="linear-button linear-button--secondary"
                  onClick={handleTutorialOpen}
                  style={{ minHeight: '44px', fontSize: '14px' }}
                >
                  사용법
                </button>
                <button
                  type="button"
                  className="linear-button linear-button--secondary"
                  data-focus-return="sheet-close"
                  onClick={() => setMobilePanel(null)}
                >
                  닫기
                </button>
              </div>
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
                  onCategoryPicked={() => setMobilePanel(null)}
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

      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(480px, calc(100% - 32px))',
          zIndex: 9990,
        }}
      >
        {inlineStatusView && (
          <div className={`linear-card ${NOTICE_TONE_CLASS[inlineStatusView.tone]}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              {inlineStatusView.lines.map((line) => (
                <p key={line} style={{ fontSize: '16px', margin: 0, lineHeight: 1.6 }}>{line}</p>
              ))}
            </div>
            <button
              type="button"
              className="linear-button linear-button--secondary"
              style={{ minHeight: '44px', minWidth: '44px', fontSize: '16px' }}
              onClick={() => setInlineStatus(null)}
            >
              닫기
            </button>
          </div>
        )}
      </div>

      {noticeView && (
        <div
          ref={noticeRef}
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
          onClick={() => {
            if (noticeView.closeActionId) handleNoticeAction(noticeView.closeActionId);
          }}
        >
          <div
            ref={noticeCardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-notice-title"
            aria-describedby="app-notice-body"
            aria-busy={noticeView.isBusy}
            tabIndex={-1}
            className="linear-card"
            style={{
              width: 'min(480px, 100%)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: '0',
              border: 'var(--border-width) solid var(--linear-neutral-500)',
            }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleNoticeKeyDown}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 id="app-notice-title" style={{ margin: 0 }}>{noticeView.title}</h3>
              <div id="app-notice-body" aria-live="polite" className={NOTICE_TONE_CLASS[noticeView.tone] || undefined}>
                {noticeView.lines.map((line) => (
                  <p key={line} style={{ margin: 0, fontSize: '16px', lineHeight: 1.6 }}>{line}</p>
                ))}
              </div>
              {noticeView.actions.length > 0 && (
                <div
                  className="linear-flex"
                  style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}
                >
                  {noticeView.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={`linear-button ${action.isPrimary ? 'linear-button--primary' : 'linear-button--secondary'}`}
                      onClick={() => handleNoticeAction(action.id)}
                      style={{ minHeight: '44px', minWidth: '44px', fontSize: '16px' }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모바일: 내보내기 오버레이 (사진에 저장) */}
      {exportOverlayOpen && (
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
            {exportMissingStickerCount > 0 && (
              <p className="linear-status--warning" style={{ marginBottom: 12 }}>{CUTOUT_COPY.missingStickers(exportMissingStickerCount)}</p>
            )}
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

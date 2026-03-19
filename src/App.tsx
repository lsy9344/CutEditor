import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import Konva from 'konva'
import { SidebarLeft } from './ui/SidebarLeft'
import { CanvasStage } from './canvas/CanvasStage'
import { SidebarRight } from './ui/SidebarRight'
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
  getMinimumTextBoxWidthForMeasuredWidth,
  resolveTextBoxWidth,
} from './canvas/textBoxWidth'
import { getFrameSelectionDecision, hasFrameContent } from './utils/frameChangeFlow'
import { getExportExperience, getExportRenderPlan } from './utils/exportBehavior'

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

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
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
  const stageRef = useRef<Konva.Stage | null>(null);
  // 모바일 내보내기 오버레이 상태
  const [exportOverlayOpen, setExportOverlayOpen] = useState<boolean>(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportObjectUrl, setExportObjectUrl] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string>("");
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

  const handleImageUpload = (file: File, slotId: string) => {
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
  }


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

  const exportBlobFromStage = useCallback(async ({
    frameType,
    stage,
  }: {
    frameType: FrameType;
    stage: Konva.Stage;
  }) => {
    const frameLayout = FRAME_LAYOUTS[frameType];
    const renderPlan = getExportRenderPlan({
      frameType,
      logicalCanvasWidth: frameLayout.canvasWidth,
      logicalCanvasHeight: frameLayout.canvasHeight,
      fallbackMaxWidthPx: 3072,
    });
    const previousSize = { width: stage.width(), height: stage.height() };
    const previousScale = { x: stage.scaleX(), y: stage.scaleY() };

    const restoreStage = () => {
      stage.size(previousSize);
      stage.scale(previousScale);
      stage.batchDraw();
    };

    const renderBlob = async (pixelRatio: number) => {
      stage.size({ width: frameLayout.canvasWidth, height: frameLayout.canvasHeight });
      stage.scale({ x: 1, y: 1 });
      stage.batchDraw();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio });
      return fetch(dataUrl).then((response) => response.blob());
    };

    try {
      try {
        return await renderBlob(renderPlan.initialPixelRatio);
      } catch (initialError) {
        if (renderPlan.fallbackPixelRatio == null) {
          throw initialError;
        }
        return await renderBlob(renderPlan.fallbackPixelRatio);
      }
    } finally {
      restoreStage();
    }
  }, []);

  // 내보내기: UI 오버레이 제거 상태에서 고해상도 PNG 추출
  const handleExport = async () => {
    const frameType = editorState.selectedFrame;
    if (!frameType) {
      alert('프레임을 먼저 선택해주세요.');
      return;
    }

    // Stage 준비 및 오버레이 제거
    setExportMode(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      const stage = stageRef.current;
      if (!stage) throw new Error('Stage가 준비되지 않았습니다.');

      const filename = makeSuggestedFilename();
      const blob = await exportBlobFromStage({ frameType, stage });
      const exportFile = new File([blob], filename, { type: 'image/png' });
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
        setExportOverlayOpen(true);
        return;
      }

      if (exportExperience === 'save-file-picker' && supportsFilePicker && window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
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
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          if (!isAbort) {
            console.warn('파일 저장 위치 선택 실패', error);
            alert('파일 저장 위치를 선택하지 못했습니다. 다운로드로 전환합니다.');
          }
        }
      }

      // 파일 시스템 접근 API 미지원 또는 취소 시 기본 다운로드로 폴백
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
      alert('내보내기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setExportMode(false);
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
    try {
      const file = new File([exportBlob], exportFilename || 'cut_export.png', { type: 'image/png' });
      const nav = navigator as unknown as { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title: string }) => Promise<void> };
      if (canShareExportFile(file) && 'share' in navigator) {
        await nav.share?.({ files: [file], title: '컷 내보내기' });
        // 공유 완료 후 오버레이 닫기
        handleCloseExportOverlay();
        return;
      }
    } catch {
      console.warn('Web Share API 실패 또는 미지원');
    }

    // 폴백 1: 다운로드 시도
    try {
      const url = exportObjectUrl || URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename || 'cut_export.png';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
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

  const sharedSidebarRightProps = {
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
      onImageTransform={handleImageTransform}
      onFrameColorChange={handleFrameColorChange}
      onTextMove={handleTextMove}
      onTextUpdate={handleTextUpdate}
      onImageDelete={handleImageDelete}
      onStickerDelete={handleStickerDelete}
      onStickerUpdate={handleStickerUpdate}
    />
  );

  const mobileSheetTitle = mobilePanel === 'frames'
    ? '프레임 선택'
    : mobilePanel === 'text'
      ? '글씨 편집'
      : '스티커 편집';

  const desktopIconButtonStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? 'var(--linear-neutral-50)' : 'transparent',
    color: isActive ? 'var(--linear-neutral-600)' : 'var(--linear-secondary-300)',
    border: 'none',
    boxShadow: 'none',
    width: '100%',
    padding: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.2s',
    fontFamily: 'var(--linear-font-family)',
  });

  return (
    <div className="app-container">
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
          <aside
            className="linear-card"
            style={{
              width: '75px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '16px 8px',
              flexShrink: 0,
            }}
          >
            {/* 프레임 */}
            <button
              ref={tutorialRef0}
              type="button"
              onClick={() => setDesktopPanel((p) => p === 'frames' ? null : 'frames')}
              style={desktopIconButtonStyle(desktopPanel === 'frames')}
              className={tutorialStep === 0 ? 'tutorial-highlight' : undefined}
            >
              <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>프레임</span>
            </button>

            {/* 글씨 */}
            <button
              ref={tutorialRef1}
              type="button"
              onClick={() => setDesktopPanel((p) => p === 'text' ? null : 'text')}
              style={desktopIconButtonStyle(desktopPanel === 'text')}
              className={tutorialStep === 1 ? 'tutorial-highlight' : undefined}
            >
              <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>글씨</span>
            </button>

            {/* 스티커 */}
            <button
              ref={tutorialRef2}
              type="button"
              onClick={() => setDesktopPanel((p) => p === 'sticker' ? null : 'sticker')}
              style={desktopIconButtonStyle(desktopPanel === 'sticker')}
              className={tutorialStep === 2 ? 'tutorial-highlight' : undefined}
            >
              <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>스티커</span>
            </button>

            <div style={{ flex: 1 }} />

            {/* 저장 */}
            <button
              ref={tutorialRef3}
              type="button"
              className={`linear-button linear-button--primary${tutorialStep === 3 ? ' tutorial-highlight' : ''}`}
              onClick={handleExport}
              style={{ width: '100%', height: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: 0 }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>저장</span>
            </button>
          </aside>
        )}

        {/* 데스크톱: 확장 가능한 왼쪽 패널 */}
        {!isMobileEditor && desktopPanel && (
          <div
            className="linear-fade-in"
            style={{
              width: '260px',
              flexShrink: 0,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
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
              <SidebarRight
                {...sharedSidebarRightProps}
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
            {/* 모바일 하단 툴바 */}
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
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
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
                <SidebarRight
                  {...sharedSidebarRightProps}
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
              공유 시트로 저장하거나 이미지를 직접 열어 사진 앱에 보관해 주세요.
            </p>
            {exportObjectUrl && (
              <img
                src={exportObjectUrl}
                alt="내보낸 이미지 미리보기"
                style={{ width: '100%', height: 'auto', borderRadius: 8, marginBottom: 12 }}
              />
            )}
            <div className="linear-flex" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => {
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

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Line, Transformer } from "react-konva";
import Konva from "konva";
import type { Template } from "../state/types";
import type { FrameType, UserImage } from "../types/frame";
import { FRAME_LAYOUTS } from "../types/frame";
import { getNextTextTransformState } from "./textTransform";
import {
  getClampedKeyboardMove,
  getContainedImageSize,
  getNextImageSelection,
  getNudgedPosition,
  getRotatedTransform,
  getScaledTransform,
  getSelectedImageFromState,
  KEYBOARD_MOVE_FAST_STEP,
  KEYBOARD_MOVE_STEP,
  KEYBOARD_ROTATE_STEP,
  KEYBOARD_SCALE_FACTOR,
} from "./keyboardShortcuts";
import { getZoomToFit } from "./zoomSizing";

// 모바일에서 드래그 중에도 동일 노드가 터치 이벤트를 계속 받도록 유지한다.
Konva.hitOnDragEnabled = true;
Konva.capturePointerEventsEnabled = true;

export type CanvasStageProps = {
  template: Template | null;
  selection: string | null;
  selectedSlot: string | null;
  zoom: number;
  selectedFrame: FrameType | null;
  userImages: UserImage[];
  frameColor: string;
  exportMode?: boolean; // 내보내기 시 UI 오버레이 숨김
  stageRefExternal?: React.RefObject<Konva.Stage | null>; // 외부에서 Stage 접근용
  texts?: Array<{
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
    textAlign: "left" | "center" | "right";
    rotation: number;
  }>;
  stickers?: Array<{
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
  }>;
  onSelect?: (id: string | null) => void;
  onSlotSelect?: (slotId: string | null) => void;
  onZoomChange?: (zoom: number) => void;
  onImageUpload?: (file: File, slotId: string) => void;
  onImageTransform?: (imageId: string, transform: Partial<UserImage>) => void;
  onFrameColorChange?: (color: string) => void;
  onTextMove?: (textId: string, x: number, y: number) => void;
  onTextUpdate?: (textId: string, updates: Partial<{
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
    textAlign: "left" | "center" | "right";
    rotation: number;
  }>) => void;
  onImageDelete?: (imageId: string) => void;
  onStickerDelete?: (stickerId: string) => void;
  onStickerUpdate?: (stickerId: string, updates: Partial<{
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
  }>) => void;
};

const toLegacyFrameFileName = (frameType: FrameType): string | null => {
  if (frameType === "1l") return "1_l";
  if (frameType === "1f") return "1_v";

  const parsed = frameType.match(/^(\d+)([a-z])(?:_(\d+))?$/i);
  if (!parsed) return null;

  const [, cutCount, orientation, variant] = parsed;
  const suffix = variant ? `_${variant}` : "";
  return `${cutCount}_${orientation.toLowerCase()}${suffix}`;
};

const buildFrameImageCandidates = (frameType: FrameType, primaryPath: string): string[] => {
  const candidates = new Set<string>([
    primaryPath,
    `/frame/${frameType}.png`,
  ]);

  const legacyFileName = toLegacyFrameFileName(frameType);
  if (legacyFileName) {
    candidates.add(`/frame/${legacyFileName}.png`);
  }

  return Array.from(candidates);
};

export const CanvasStage: React.FC<CanvasStageProps> = ({
  selection,
  zoom,
  selectedFrame,
  selectedSlot,
  userImages,
  frameColor,
  exportMode = false,
  stageRefExternal,
  texts = [],
  stickers = [],
  onSelect,
  onSlotSelect,
  onImageUpload,
  onImageTransform,
  onFrameColorChange,
  onTextMove,
  onTextUpdate,
  onZoomChange,
  onImageDelete,
  onStickerDelete,
  onStickerUpdate
}) => {
  // 모든 hook들을 먼저 호출 (조건부 렌더링 전에)
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 컨테이너 측정 크기 (피드백 루프 방지용)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // 커스텀 컬러 팔레트 관련
  const [showCustomPalette, setShowCustomPalette] = useState(false);
  const paletteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteAnchorRef = useRef<HTMLDivElement | null>(null);
  const customPickButtonRef = useRef<HTMLButtonElement | null>(null);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement | null>>(new Map());
  const [loadedStickerImages, setLoadedStickerImages] = useState<Map<string, HTMLImageElement | null>>(new Map());
  const [processedFrameCanvas, setProcessedFrameCanvas] = useState<HTMLCanvasElement | null>(null);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const currentSlotIdRef = useRef<string | null>(null);
  const stickerLoadSourcesRef = useRef<Map<string, string>>(new Map());
  const stickerImageRefs = useRef<Record<string, Konva.Image | null>>({});
  // 빠른 선택 스와치 색상 (외부 설정으로 오버라이드 가능)
  const [presetColors, setPresetColors] = useState<string[]>([
    '#FFFFFF', // White
    '#000000', // Black
    '#DCDCDC', // Light Gray.
    '#fe9fb3', // Deep Pink.
    '#ffe4c4', // Gold
    '#C8F7DC', // Mint.
    '#C6E2FF', // Light Blue.
    '#ffc1cc', // Rose Pink.
  ]);

  const frameLayout = selectedFrame ? FRAME_LAYOUTS[selectedFrame] : null;
  const selectedImage = getSelectedImageFromState({ selection, selectedSlot, userImages });
  const selectedSticker = selection ? stickers.find((sticker) => sticker.id === selection) ?? null : null;
  const isTouchManipulationActive = Boolean(selection);

  const focusCanvasArea = useCallback(() => {
    stageWrapperRef.current?.focus({ preventScroll: true });
  }, []);

  const setStageCursor = useCallback((cursor: string) => {
    const stageContainer = stageRef.current?.container();
    if (stageContainer) {
      stageContainer.style.cursor = cursor;
    }
  }, []);

  const selectImage = useCallback((imageId: string, slotId: string) => {
    if (selection === imageId && selectedSlot === slotId) {
      focusCanvasArea();
      return;
    }
    onSelect?.(imageId);
    onSlotSelect?.(slotId);
    focusCanvasArea();
  }, [focusCanvasArea, onSelect, onSlotSelect, selectedSlot, selection]);

  const selectSticker = useCallback((stickerId: string) => {
    if (selection === stickerId) {
      focusCanvasArea();
      return;
    }
    onSelect?.(stickerId);
    focusCanvasArea();
  }, [focusCanvasArea, onSelect, selection]);

  const selectText = useCallback((textId: string) => {
    if (selection === textId) {
      focusCanvasArea();
      return;
    }
    onSelect?.(textId);
    focusCanvasArea();
  }, [focusCanvasArea, onSelect, selection]);

  const clearCanvasSelection = useCallback(() => {
    onSelect?.(null);
    onSlotSelect?.(null);
    setStageCursor("default");
  }, [onSelect, onSlotSelect, setStageCursor]);

  const handleStagePointerDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      focusCanvasArea();
      clearCanvasSelection();
    }
  }, [clearCanvasSelection, focusCanvasArea]);

  const getImageDisplayContext = useCallback((image: Pick<UserImage, "id" | "slotId">) => {
    if (!frameLayout) return null;

    const slot = frameLayout.slots.find((item) => item.id === image.slotId);
    if (!slot) return null;

    const loadedImage = loadedImages.get(image.id);
    if (!(loadedImage instanceof HTMLImageElement)) return null;

    return {
      slot,
      displaySize: getContainedImageSize(
        loadedImage.width,
        loadedImage.height,
        slot.width,
        slot.height,
      ),
    };
  }, [frameLayout, loadedImages]);

  // 텍스트 세로 배치 유틸리티 함수
  const formatVerticalText = (text: string, isVertical: boolean): string => {
    return isVertical ? text.split('').join('\n') : text;
  };

  // 텍스트 크기 계산 유틸리티 함수
  const getTextDimensions = (text: string, fontSize: number, fontFamily: string, isBold: boolean, isItalic: boolean, isVertical: boolean) => {
    if (isVertical) {
      // 세로 배치일 때
      const lines = text.split('\n');
      const maxLength = Math.max(1, ...lines.map(line => line.length));
      return {
        width: fontSize * 0.6, // 한 글자 폭
        height: Math.max(text.length, maxLength) * fontSize // 글자 수 × 폰트 크기
      };
    } else {
      // 가로 배치일 때 - 캔버스로 정확한 측정
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const lines = text.split('\n');

      if (ctx) {
        ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
        const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        return {
          width: maxWidth,
          height: fontSize * lines.length
        };
      }
      // 폴백: 근사치 계산
      const maxLength = Math.max(...lines.map(line => line.length));
      return {
        width: maxLength * fontSize * 0.6,
        height: fontSize * lines.length
      };
    }
  };

  // 팔레트 미리보기 상태 (항상 동일 훅 순서 유지를 위해 상단으로 이동)
  const [palettePreview, setPalettePreview] = useState<{
    visible: boolean;
    x: number;
    y: number;
    color: string;
  }>({ visible: false, x: 0, y: 0, color: '#FFFFFF' });

  // 프레임 이미지 로드 (캐시 우회 및 오류 처리)
  useEffect(() => {
    if (selectedFrame && frameLayout) {
      let cancelled = false;
      const sources = buildFrameImageCandidates(selectedFrame, frameLayout.imagePath);
      let currentSourceIndex = 0;

      const tryLoad = () => {
        if (cancelled) return;

        const source = sources[currentSourceIndex];
        if (!source) {
          console.warn(`[CanvasStage] 프레임 이미지를 불러오지 못했습니다: ${selectedFrame}`);
          setFrameImage(null);
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!cancelled) {
            setFrameImage(img);
          }
        };
        img.onerror = () => {
          currentSourceIndex += 1;
          tryLoad();
        };

        const bust = `${source}${source.includes("?") ? "&" : "?"}t=${Date.now()}`;
        img.src = bust;
      };

      setFrameImage(null);
      tryLoad();

      return () => {
        cancelled = true;
      };
    } else {
      setFrameImage(null);
    }
  }, [selectedFrame, frameLayout?.imagePath]);

  // 헥사 색상 -> RGB 변환
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const s = hex.replace('#', '');
    if (s.length === 3) {
      const r = parseInt(s[0] + s[0], 16);
      const g = parseInt(s[1] + s[1], 16);
      const b = parseInt(s[2] + s[2], 16);
      return { r, g, b };
    }
    if (s.length === 6) {
      const r = parseInt(s.slice(0, 2), 16);
      const g = parseInt(s.slice(2, 4), 16);
      const b = parseInt(s.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  };

  // 프레임 이미지의 흰색 영역을 선택된 색으로 치환
  useEffect(() => {
    if (!frameImage || !frameColor) {
      setProcessedFrameCanvas(null);
      return;
    }

    const rgb = hexToRgb(frameColor);
    if (!rgb) {
      setProcessedFrameCanvas(null);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setProcessedFrameCanvas(null);
      return;
    }

    // 원본 이미지 크기 기준으로 처리
    const w = frameImage.naturalWidth || frameImage.width;
    const h = frameImage.naturalHeight || frameImage.height;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(frameImage, 0, 0, w, h);

    try {
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      // 임계값: 거의 흰색(밝은 영역)만 치환
      const whiteThreshold = 245; // 0~255
      const alphaThreshold = 10;  // 투명 픽셀은 무시

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a > alphaThreshold && r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          // alpha는 유지
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setProcessedFrameCanvas(canvas);
    } catch {
      // CORS 또는 다른 이유로 접근 실패 시 원본 사용
      setProcessedFrameCanvas(null);
    }
  }, [frameImage, frameColor]);

  // 사용자 이미지 로드
  useEffect(() => {
    userImages.forEach(userImage => {
      if (!loadedImages.has(userImage.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          setLoadedImages(prev => new Map(prev).set(userImage.id, img));
        };
        img.onerror = () => {
          console.error(`Failed to load image: ${userImage.id}`);
          // 로딩 실패한 이미지도 Map에 null로 추가하여 무한 재시도 방지
          setLoadedImages(prev => new Map(prev).set(userImage.id, null));
        };
        img.src = userImage.url;
      }
    });
  }, [userImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const activeStickerIds = new Set(stickers.map((sticker) => sticker.id));

    Object.keys(stickerImageRefs.current).forEach((stickerId) => {
      if (!activeStickerIds.has(stickerId)) {
        delete stickerImageRefs.current[stickerId];
      }
    });

    setLoadedStickerImages((prev) => {
      const next = new Map<string, HTMLImageElement | null>();
      prev.forEach((image, stickerId) => {
        if (activeStickerIds.has(stickerId)) {
          next.set(stickerId, image);
        }
      });
      return next;
    });

    Array.from(stickerLoadSourcesRef.current.keys()).forEach((stickerId) => {
      if (!activeStickerIds.has(stickerId)) {
        stickerLoadSourcesRef.current.delete(stickerId);
      }
    });

    stickers.forEach((sticker) => {
      if (stickerLoadSourcesRef.current.get(sticker.id) === sticker.src) {
        return;
      }

      stickerLoadSourcesRef.current.set(sticker.id, sticker.src);
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        if (stickerLoadSourcesRef.current.get(sticker.id) !== sticker.src) return;
        setLoadedStickerImages((prev) => new Map(prev).set(sticker.id, image));
      };
      image.onerror = () => {
        if (stickerLoadSourcesRef.current.get(sticker.id) !== sticker.src) return;
        setLoadedStickerImages((prev) => new Map(prev).set(sticker.id, null));
      };
      image.src = sticker.src;
    });
  }, [stickers]);

  useEffect(() => {
    stickers.forEach((sticker) => {
      const node = stickerImageRefs.current[sticker.id];
      if (!node) return;

      if (sticker.tintColor) {
        node.cache();
      } else {
        node.clearCache();
      }
      node.getLayer()?.batchDraw();
    });
  }, [loadedStickerImages, stickers]);

  useEffect(() => {
    stickers.forEach((sticker) => {
      const node = stickerImageRefs.current[sticker.id];
      if (!node) return;

      const tr = node.getStage()?.findOne(`#transformer-${sticker.id}`) as Konva.Transformer | null;
      if (!tr) return;

      if (selection === sticker.id) {
        tr.nodes([node]);
      } else if (tr.nodes().length > 0) {
        tr.nodes([]);
      }
      tr.getLayer()?.batchDraw();
    });
  }, [loadedStickerImages, selection, stickers]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    if (!onImageUpload) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    const slotId = currentSlotIdRef.current;

    if (imageFile && slotId) {
      onImageUpload(imageFile, slotId);
    }

    setDraggedSlotId(null);
    currentSlotIdRef.current = null;
  }, [onImageUpload]);

  // 슬롯 클릭 핸들러 (선택 상태 변경 및 파일 선택)
  const handleSlotClick = (slotId: string) => {
    console.log('🔥 handleSlotClick called with slotId:', slotId);

    // 슬롯 선택 상태 업데이트
    onSelect?.(null);
    onSlotSelect?.(slotId);
    focusCanvasArea();

    setDraggedSlotId(slotId);
    currentSlotIdRef.current = slotId; // ref에도 저장
    console.log('🔥 currentSlotIdRef.current set to:', currentSlotIdRef.current);
    // 모바일/Safari에서도 사용자 제스처 내에서 동작하도록 즉시 트리거
    fileInputRef.current?.click();
    console.log('🔥 fileInputRef.current.click() executed');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔥 handleFileSelect called');
    const file = e.target.files?.[0];
    console.log('🔥 selected file:', file);
    console.log('🔥 draggedSlotId:', draggedSlotId);
    console.log('🔥 currentSlotIdRef.current:', currentSlotIdRef.current);
    console.log('🔥 onImageUpload function:', onImageUpload);

    const slotId = currentSlotIdRef.current; // ref에서 가져오기

    if (file && slotId && onImageUpload) {
      console.log('🔥 calling onImageUpload with:', file.name, slotId);
      onImageUpload(file, slotId);
    } else {
      console.log('🔥 onImageUpload not called. file:', !!file, 'slotId:', !!slotId, 'onImageUpload:', !!onImageUpload);
    }

    setDraggedSlotId(null);
    currentSlotIdRef.current = null; // ref 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 변형 핸들러
  const handleImageTransform = (
    imageId: string,
    newAttrs: { x?: number; y?: number; scaleX?: number; scaleY?: number; rotation?: number }
  ) => {
    if (!onImageTransform) return;
    const payload: Partial<UserImage> = {};
    if (typeof newAttrs.x === 'number' && Number.isFinite(newAttrs.x)) payload.x = newAttrs.x;
    if (typeof newAttrs.y === 'number' && Number.isFinite(newAttrs.y)) payload.y = newAttrs.y;
    if (typeof newAttrs.scaleX === 'number' && Number.isFinite(newAttrs.scaleX)) payload.scaleX = newAttrs.scaleX;
    if (typeof newAttrs.scaleY === 'number' && Number.isFinite(newAttrs.scaleY)) payload.scaleY = newAttrs.scaleY;
    if (typeof newAttrs.rotation === 'number' && Number.isFinite(newAttrs.rotation)) payload.rotation = newAttrs.rotation;
    // 변경이 없으면 호출 생략
    if (Object.keys(payload).length === 0) return;
    onImageTransform(imageId, payload);
  };

  const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (exportMode || showCustomPalette || !frameLayout) return;

    const target = e.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onSelect?.(null);
      onSlotSelect?.(null);
      return;
    }

    if (e.key === "Tab") {
      const nextSelection = getNextImageSelection({
        selection,
        selectedSlot,
        slotOrder: frameLayout.slots.map((slot) => slot.id),
        userImages,
        direction: e.shiftKey ? -1 : 1,
      });

      if (nextSelection) {
        e.preventDefault();
        selectImage(nextSelection.imageId, nextSelection.slotId);
      }
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (selectedSticker) {
        onStickerDelete?.(selectedSticker.id);
        return;
      }
      if (!selectedImage) return;
      onImageDelete?.(selectedImage.id);
      return;
    }

    if (!selectedImage) return;

    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      handleImageTransform(selectedImage.id, getScaledTransform({
        image: selectedImage,
        scaleFactor: KEYBOARD_SCALE_FACTOR,
      }));
      return;
    }

    if (e.key === "-") {
      e.preventDefault();
      handleImageTransform(selectedImage.id, getScaledTransform({
        image: selectedImage,
        scaleFactor: 1 / KEYBOARD_SCALE_FACTOR,
      }));
      return;
    }

    if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      handleImageTransform(selectedImage.id, getRotatedTransform({
        image: selectedImage,
        deltaDegrees: e.shiftKey ? -KEYBOARD_ROTATE_STEP : KEYBOARD_ROTATE_STEP,
      }));
      return;
    }

    const movementByKey: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };

    const movement = movementByKey[e.key];
    if (!movement) return;

    e.preventDefault();
    const step = e.shiftKey ? KEYBOARD_MOVE_FAST_STEP : KEYBOARD_MOVE_STEP;
    const delta = {
      x: movement.x * step,
      y: movement.y * step,
    };

    if (selectedSticker) {
      onStickerUpdate?.(selectedSticker.id, getNudgedPosition({
        x: selectedSticker.x,
        y: selectedSticker.y,
        delta,
      }));
      return;
    }

    const context = getImageDisplayContext(selectedImage);
    if (!context) return;

    handleImageTransform(selectedImage.id, getClampedKeyboardMove({
      image: selectedImage,
      slot: context.slot,
      displaySize: context.displaySize,
      delta,
    }));
  }, [
    exportMode,
    frameLayout,
    getImageDisplayContext,
    handleImageTransform,
    onImageDelete,
    onSelect,
    onSlotSelect,
    onStickerDelete,
    onStickerUpdate,
    selectImage,
    selectedImage,
    selectedSticker,
    selectedSlot,
    selection,
    showCustomPalette,
    userImages,
  ]);

  // 이미지 휠 줌 핸들러 (해당 슬롯/이미지에만 적용)
  const handleImageWheel = (
    e: Konva.KonvaEventObject<WheelEvent>,
    imageId: string,
    slot?: { x: number; y: number; width: number; height: number },
    displayWidth?: number,
    displayHeight?: number
  ) => {
    console.log('[wheel] start', { imageId, hasSlot: !!slot, deltaY: e.evt?.deltaY, hasTransformCb: typeof onImageTransform === 'function' });
    // 상위로 버블링되거나 페이지 스크롤 되지 않도록 차단
    e.evt.preventDefault();
    // Konva 이벤트 버블 차단
    (e as { cancelBubble?: boolean }).cancelBubble = true;

    const userImage = userImages.find(img => img.id === imageId);
    if (!userImage) return;

    // 휠 시 선택 동기화 (원본 PySide 동작 참고)
    onSelect?.(userImage.id);
    onSlotSelect?.(userImage.slotId);
    console.log('[wheel] selecting', { imageId: userImage.id, slotId: userImage.slotId });

    const scaleBy = 1.1;
    // 실제 노드 스케일을 우선 사용(상태-뷰 불일치 방지)
    let oldScale = Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1;
    const deltaY = e.evt.deltaY;
    console.log('[wheel] scales', { oldScale, deltaY });

    // deltaY NaN 체크
    if (isNaN(deltaY)) return;

    const newScale = deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    // 스케일 제한 상한 제거 (하한만 유지하여 0 이하 방지)
    const clampedScale = Math.max(0.1, newScale);
    console.log('[wheel] newScale', { newScale, clampedScale });

    // 최종 NaN 체크
    if (isNaN(clampedScale)) return;

    // 스케일 적용 + 포인터 기준 위치 보정
    const nextTransform: Partial<UserImage> = { scaleX: clampedScale, scaleY: clampedScale };

    if (slot && displayWidth && displayHeight) {
      const targetNode = e.target as unknown as Konva.Node;
      // 실제 이미지 노드 찾기(배경 Rect에서 휠이 들어온 경우 대비)
      let imgNode: Konva.Image | null = null;
      if ((targetNode as Konva.Node & { className?: string }).className === 'Image') {
        imgNode = targetNode as unknown as Konva.Image;
      } else {
        const parent = (targetNode as Konva.Node & { getParent?: () => Konva.Container })?.getParent?.();
        const found = parent?.findOne('Image') as Konva.Image | undefined;
        if (found) imgNode = found;
      }
      if (!imgNode) return;

      const stage = imgNode.getStage();
      // 휠 이벤트에서 getPointerPosition이 누락되는 경우가 있어, 이벤트 좌표로 보정
      let px: number | undefined;
      let py: number | undefined;
      if (stage && e.evt && typeof e.evt.clientX === 'number' && typeof e.evt.clientY === 'number') {
        try {
          const rect = stage.container().getBoundingClientRect();
          const stageScaleX = stage.scaleX() || 1;
          const stageScaleY = stage.scaleY() || 1;
          px = (e.evt.clientX - rect.left) / stageScaleX;
          py = (e.evt.clientY - rect.top) / stageScaleY;
        } catch {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const stageScaleX = stage.scaleX() || 1;
            const stageScaleY = stage.scaleY() || 1;
            px = pointer.x / stageScaleX;
            py = pointer.y / stageScaleY;
          }
        }
      } else if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const stageScaleX = stage.scaleX() || 1;
          const stageScaleY = stage.scaleY() || 1;
          px = pointer.x / stageScaleX;
          py = pointer.y / stageScaleY;
        }
      }

      // 최신 노드 스케일을 기준(oldScale 보정)
      const nodeScale = Number.isFinite(imgNode.scaleX()) ? imgNode.scaleX() : oldScale;
      if (Number.isFinite(nodeScale)) oldScale = nodeScale;

      // 현재 노드 위치(무조건 유효값으로 보정)
      const imgX = Number.isFinite(imgNode.x()) ? imgNode.x() : slot.x;
      const imgY = Number.isFinite(imgNode.y()) ? imgNode.y() : slot.y;

      // 로컬 좌표(anchor): 포인터가 없으면 이미지 중앙 기준으로 고정
      const localX = px !== undefined ? (px - imgX) / oldScale : (displayWidth / 2);
      const localY = py !== undefined ? (py - imgY) / oldScale : (displayHeight / 2);

      // 새 스케일에서 포인터(또는 중앙) 고정되도록 원점 이동
      let newImgX = (px !== undefined ? px : (imgX + localX * oldScale)) - localX * clampedScale;
      let newImgY = (py !== undefined ? py : (imgY + localY * oldScale)) - localY * clampedScale;

      // 슬롯 경계로 위치 클램프 - X축과 Y축 모두 자유롭게 이동 허용
      const scaledW = displayWidth * clampedScale;
      const scaledH = displayHeight * clampedScale;

      // X축: 이미지가 슬롯 밖으로도 자유롭게 이동 허용
      const minX = slot.x - scaledW;
      const maxX = slot.x + slot.width;

      // Y축: X축과 동일하게 이미지가 슬롯 밖으로도 자유롭게 이동 허용
      const minY = slot.y - scaledH;
      const maxY = slot.y + slot.height;
      newImgX = Math.max(minX, Math.min(maxX, newImgX));
      newImgY = Math.max(minY, Math.min(maxY, newImgY));

      // 상태 저장용 상대 좌표로 변환 (항상 x/y 포함시켜 재렌더 시 튐 방지)
      const relX = newImgX - slot.x - (slot.width - displayWidth) / 2;
      const relY = newImgY - slot.y - (slot.height - displayHeight) / 2;
      if (!isNaN(relX)) nextTransform.x = relX;
      if (!isNaN(relY)) nextTransform.y = relY;
      console.log('[wheel] nextTransform', nextTransform);
    }

    console.log('[wheel] dispatch transform', nextTransform);
    // 내부 핸들러 통해 상태 업데이트(유효 필드만 반영)
    handleImageTransform(imageId, nextTransform);
    console.log('[wheel] applied');
  };

  // ===== 모바일 핀치 줌 지원 =====
  const pinchRef = useRef<{
    imageId: string | null;
    initDistance: number;
    initScale: number;
    slot?: { x: number; y: number; width: number; height: number };
    displayWidth?: number;
    displayHeight?: number;
  } | null>(null);

  const getTouchDistance = (evt: TouchEvent) => {
    if (evt.touches.length < 2) return 0;
    const [t1, t2] = [evt.touches[0], evt.touches[1]];
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleImageTouchStart = useCallback((
    e: Konva.KonvaEventObject<TouchEvent>,
    imageId: string,
    slot?: { x: number; y: number; width: number; height: number },
    displayWidth?: number,
    displayHeight?: number
  ) => {
    const userImage = userImages.find((img) => img.id === imageId);
    if (!userImage) return;

    const isSelectedImage = selection === imageId;
    if (!isSelectedImage && e.evt.touches.length < 2) {
      pinchRef.current = null;
      return;
    }

    if (!isSelectedImage) {
      selectImage(userImage.id, userImage.slotId);
    }

    if (e.evt.touches.length < 2) {
      pinchRef.current = null;
      return;
    }

    e.evt.preventDefault();
    pinchRef.current = {
      imageId,
      initDistance: getTouchDistance(e.evt),
      initScale: Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1,
      slot,
      displayWidth,
      displayHeight,
    };
  }, [selectImage, selection, userImages]);

  const handleImageTouchMove = useCallback((
    e: Konva.KonvaEventObject<TouchEvent>,
    imageId: string
  ) => {
    const state = pinchRef.current;
    if (!state || state.imageId !== imageId) return;
    if (e.evt.touches.length < 2) return;
    e.evt.preventDefault();

    const newDist = getTouchDistance(e.evt);
    if (!newDist || !state.initDistance) return;
    const scaleBy = newDist / state.initDistance;
    let nextScale = state.initScale * scaleBy;
    const minScale = Math.max(0.2, 1e-3);
    const maxScale = 10;
    nextScale = Math.max(minScale, Math.min(maxScale, nextScale));

    const transform: Partial<UserImage> = { scaleX: nextScale, scaleY: nextScale };

    // 슬롯 경계 보정 (이미지 위치는 유지하되 범위를 벗어나지 않도록 클램프)
    if (state.slot && state.displayWidth && state.displayHeight) {
      const node = e.target as unknown as Konva.Node;
      const imgX = Number.isFinite(node.x()) ? node.x() : state.slot.x;
      const imgY = Number.isFinite(node.y()) ? node.y() : state.slot.y;
      const scaledW = state.displayWidth * nextScale;
      const scaledH = state.displayHeight * nextScale;
      const minX = state.slot.x - scaledW;
      const maxX = state.slot.x + state.slot.width;
      const minY = state.slot.y - scaledH;
      const maxY = state.slot.y + state.slot.height;
      const clampedX = Math.max(minX, Math.min(maxX, imgX));
      const clampedY = Math.max(minY, Math.min(maxY, imgY));
      const relX = clampedX - state.slot.x - (state.slot.width - state.displayWidth) / 2;
      const relY = clampedY - state.slot.y - (state.slot.height - state.displayHeight) / 2;
      if (!isNaN(relX)) transform.x = relX;
      if (!isNaN(relY)) transform.y = relY;
    }

    handleImageTransform(imageId, transform);
  }, [handleImageTransform]);

  const handleImageTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) {
      pinchRef.current = null;
    }
  };

  // 이미지 드래그 이동 제한 핸들러
  const handleImageDragMove = (e: Konva.KonvaEventObject<DragEvent>, imageId: string, slot: { x: number; y: number; width: number; height: number }, displayWidth: number, displayHeight: number) => {
    const userImage = userImages.find(img => img.id === imageId);
    if (!userImage) return;

    const node = e.target;
    const currentX = node.x();
    const currentY = node.y();

    // NaN 체크
    if (isNaN(currentX) || isNaN(currentY)) return;

    // 즉시 갱신된 Konva 노드의 실제 스케일을 우선 사용 (휠 줌 직후 상태 반영 지연에 의한 튐 방지)
    const nodeScaleX = Number.isFinite((node as Konva.Node).scaleX()) ? (node as Konva.Node).scaleX() : (Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1);
    const nodeScaleY = Number.isFinite((node as Konva.Node).scaleY()) ? (node as Konva.Node).scaleY() : (Number.isFinite(userImage.scaleY) ? userImage.scaleY : 1);
    const scaledWidth = displayWidth * nodeScaleX;
    const scaledHeight = displayHeight * nodeScaleY;

    // NaN 체크
    if (isNaN(scaledWidth) || isNaN(scaledHeight)) return;

    // 슬롯 밖으로 자유롭게 이미지 이동 허용 (X축과 Y축 동일하게)

    // X축: 이미지가 슬롯 밖으로도 자유롭게 이동 가능
    const minX = slot.x - scaledWidth;
    const maxX = slot.x + slot.width;

    // Y축: X축과 동일하게 이미지가 슬롯 밖으로도 자유롭게 이동 가능
    const minY = slot.y - scaledHeight;
    const maxY = slot.y + slot.height;

    // NaN 체크
    if (isNaN(minX) || isNaN(maxX) || isNaN(minY) || isNaN(maxY)) return;

    // 경계 제한 적용
    const clampedX = Math.max(minX, Math.min(maxX, currentX));
    const clampedY = Math.max(minY, Math.min(maxY, currentY));

    // 최종 NaN 체크
    if (!isNaN(clampedX)) {
      node.x(clampedX);
    }
    if (!isNaN(clampedY)) {
      node.y(clampedY);
    }
  };

  // 외부 팔레트 설정 로드 (배포자가 편집 가능)
  // 주의: 훅 순서를 안정화하기 위해 조건부 반환보다 위에서 호출
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/config/frame_palette.json', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const arr = Array.isArray(json) ? json : Array.isArray((json as Record<string, unknown>)?.frameColors) ? (json as Record<string, unknown>).frameColors : null;
        if (!arr) return;
        const hexRe = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
        const normalized = (arr as unknown[]).filter((c) => typeof c === 'string' && hexRe.test(c as string)) as string[];
        if (!cancelled && normalized.length > 0) {
          setPresetColors(normalized.slice(0, 24)); // 최대 24개까지 허용
        }
      } catch (error) {
        // 네트워크/파싱 오류 시 기본값 유지
        console.warn('Failed to load frame palette config:', error);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // 커스텀 원형 팔레트 렌더링 (showCustomPalette 의존)
  // 주의: 훅 순서를 안정화하기 위해 조건부 반환보다 위에서 호출
  useEffect(() => {
    if (!showCustomPalette) return;
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const size = 160;
    const radius = size / 2 - 2; // padding for border
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - size / 2;
        const dy = y - size / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;
        if (dist <= radius) {
          let angle = Math.atan2(dy, dx); // -PI..PI
          if (angle < 0) angle += Math.PI * 2; // 0..2PI
          const h = (angle * 180) / Math.PI; // 0..360
          const s = Math.min(1, dist / radius);
          const v = 1; // 최대 명도
          const { r, g, b } = hsvToRgb(h, s, v);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // 외곽선
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius + 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [showCustomPalette]);

  // 팔레트 외부 클릭 시 닫기
  // 주의: 훅 순서를 안정화하기 위해 조건부 반환보다 위에서 호출
  useEffect(() => {
    if (!showCustomPalette) return;
    const onDown = (e: MouseEvent) => {
      const anchor = paletteAnchorRef.current;
      const btn = customPickButtonRef.current;
      if (!anchor || !btn) return;
      if (!anchor.contains(e.target as Node) && !btn.contains(e.target as Node)) {
        setShowCustomPalette(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCustomPalette(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showCustomPalette]);

  useEffect(() => {
    const stageContainer = stageRef.current?.container();
    if (!stageContainer) return;

    const touchAction = isTouchManipulationActive ? 'none' : 'pan-x pan-y';
    stageContainer.style.touchAction = touchAction;

    const canvases = stageContainer.querySelectorAll("canvas");
    canvases.forEach((canvas) => {
      canvas.style.touchAction = touchAction;
      canvas.style.userSelect = "none";
      canvas.style.webkitUserSelect = "none";
    });

    if (!isTouchManipulationActive) {
      setStageCursor("default");
    }
  }, [isTouchManipulationActive, setStageCursor]);

  // 컨테이너 크기 측정 (Stage 콘텐츠 크기와 독립적으로 동작)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measureContainer = () => {
      const measuredWidth = Math.round(node.clientWidth || node.getBoundingClientRect().width);
      const measuredHeight = Math.round(node.clientHeight || node.getBoundingClientRect().height);

      if (measuredWidth > 100 && measuredHeight > 100) {
        setContainerSize({ width: measuredWidth, height: measuredHeight });
      }
    };

    measureContainer();

    // ResizeObserver로 너비 변화 감지 (사이드바 크기 변경 등)
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measureContainer());
      observer.observe(node);
      // 부모도 관찰하여 레이아웃 변화 감지
      const parent = node.parentElement;
      if (parent) observer.observe(parent);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measureContainer);
      return () => window.removeEventListener('resize', measureContainer);
    }
  }, []);

  // 측정된 컨테이너 크기 기반으로 zoom 자동 조정
  useEffect(() => {
    if (!frameLayout || !onZoomChange) return;
    if (!containerSize.width || !containerSize.height) return;
    const isMobileViewport = typeof window !== "undefined" && window.innerWidth <= 768;

    const clamped = getZoomToFit({
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      canvasWidth: frameLayout.canvasWidth,
      canvasHeight: frameLayout.canvasHeight,
      fitMode: isMobileViewport ? "width" : "contain",
    });

    if (Math.abs(clamped - zoom) > 0.005) {
      onZoomChange(clamped);
    }
  }, [frameLayout, containerSize, onZoomChange, zoom]);

  // 프레임이 선택되지 않았을 때 메시지 표시
  if (!selectedFrame || !frameLayout) {
    return (
      <div className="linear-card linear-fade-in" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center'
      }}>
        <div>
          <h3 style={{ marginBottom: '16px' }}></h3>
          <p style={{
            color: 'var(--linear-secondary-400)',
            fontSize: 'var(--linear-text-lg)',
            fontWeight: 'var(--linear-font-medium)'
          }}>
            왼쪽 메뉴에서 프레임을 먼저 선택해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // Stage wrapper에 고정 크기를 설정하여 Stage 콘텐츠가 컨테이너를 확장하지 않도록 함
  const stageWidth = Math.ceil(frameLayout.canvasWidth * zoom);
  const stageHeight = Math.ceil(frameLayout.canvasHeight * zoom);
  const stageWrapperStyle: React.CSSProperties = {
    border: 'var(--border-width) dashed var(--linear-neutral-500)',
    borderRadius: '0px',
    boxSizing: 'content-box',
    overflow: 'hidden',
    position: 'relative',
    width: `${stageWidth}px`,
    height: `${stageHeight}px`,
    maxWidth: '100%',
    flexShrink: 0,
  };

  // HSV -> RGB 변환
  const hsvToRgb = (h: number, s: number, v: number) => {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r1 = 0, g1 = 0, b1 = 0;
    if (0 <= h && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (60 <= h && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (120 <= h && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (180 <= h && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (240 <= h && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    return { r, g, b };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };

  const getColorFromPosition = (canvas: HTMLCanvasElement, x: number, y: number) => {
    const size = canvas.width;
    const radius = size / 2 - 2;
    const dx = x - size / 2;
    const dy = y - size / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) return null;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    const h = (angle * 180) / Math.PI;
    const s = Math.min(1, dist / radius);
    const v = 1;
    const { r, g, b } = hsvToRgb(h, s, v);
    return rgbToHex(r, g, b);
  };

  const handlePalettePick = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const hex = getColorFromPosition(canvas, x, y);
    if (!hex) return;
    onFrameColorChange?.(hex);
    setShowCustomPalette(false);
  };

  const handlePaletteMove = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const hex = getColorFromPosition(canvas, x, y);
    if (!hex) {
      setPalettePreview((p) => ({ ...p, visible: false }));
      return;
    }
    // 미리보기는 커서 바로 위에 약간 오프셋
    const offsetX = 14;
    const offsetY = -18;
    setPalettePreview({ visible: true, x: x + offsetX, y: y + offsetY, color: hex });
  };

  const handlePaletteLeave = () => {
    setPalettePreview((p) => ({ ...p, visible: false }));
  };

  return (
    <div className="linear-card linear-fade-in" style={{ height: '100%', overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="canvas-stage-layout">
        <div
          ref={containerRef}
          className="canvas-stage-area"
        >
          <div
            ref={stageWrapperRef}
            style={stageWrapperStyle}
            tabIndex={0}
            role="application"
            aria-label="캔버스 편집 영역"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onKeyDown={handleCanvasKeyDown}
          >
            <Stage
              ref={(node) => {
                stageRef.current = node;
                if (stageRefExternal) {
                  // 외부에서도 동일 참조를 사용할 수 있게 전달
                  (stageRefExternal as React.MutableRefObject<Konva.Stage | null>).current = node;
                }
              }}
              width={stageWidth}
              height={stageHeight}
              scaleX={zoom}
              scaleY={zoom}
              onMouseDown={handleStagePointerDown}
              onTouchStart={handleStagePointerDown}
              onClick={(e) => {
                if (e.target === e.target.getStage()) {
                  focusCanvasArea();
                  clearCanvasSelection();
                }
              }}
            >
              {/* 프레임 이미지 레이어 (사용자 이미지 아래에 배치) */}
              <Layer>
                {/* 배경: 프레임 이미지가 있으면 먼저 그려서 보이도록 함 */}
                {frameImage ? (
                  <KonvaImage
                    image={processedFrameCanvas ?? frameImage}
                    x={0}
                    y={0}
                    width={frameLayout.canvasWidth}
                    height={frameLayout.canvasHeight}
                    listening={false}
                  />
                ) : (
                  <Rect
                    x={0}
                    y={0}
                    width={frameLayout.canvasWidth}
                    height={frameLayout.canvasHeight}
                    fill="white"
                  />
                )}
              </Layer>

              {/* 사용자 이미지 레이어 (프레임 이미지 위에 배치) */}
              <Layer>
                {frameLayout.slots.map((slot) => {
                  const userImage = userImages.find(img => img.slotId === slot.id);
                  const loadedImg = userImage ? loadedImages.get(userImage.id) : null;

                  if (userImage && loadedImg && loadedImg !== null) {
                    const isSelectedImage = selection === userImage.id;
                    const { width: displayWidth, height: displayHeight } = getContainedImageSize(
                      loadedImg.width,
                      loadedImg.height,
                      slot.width,
                      slot.height,
                    );

                    // NaN 방어: 사용자 변형 값 보정
                    const uX = Number.isFinite(userImage.x) ? userImage.x : 0;
                    const uY = Number.isFinite(userImage.y) ? userImage.y : 0;
                    const uScaleX = Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1;
                    const uScaleY = Number.isFinite(userImage.scaleY) ? userImage.scaleY : 1;
                    const uRotation = Number.isFinite(userImage.rotation) ? userImage.rotation : 0;

                    // 중앙 정렬을 위한 오프셋 계산 (top-left 좌표)
                    const centerX = slot.x + (slot.width - displayWidth) / 2 + uX;
                    const centerY = slot.y + (slot.height - displayHeight) / 2 + uY;

                    return (
                      <Group
                        key={slot.id}
                        clipFunc={(ctx) => {
                          // 슬롯 영역으로 클리핑
                          ctx.rect(slot.x, slot.y, slot.width, slot.height);
                        }}
                      >
                        {/* 슬롯 내부 빈 영역의 휠/클릭 처리를 위한 백그라운드 캡처 (이미지 아래 배치) */}
                        <Rect
                          x={slot.x}
                          y={slot.y}
                          width={slot.width}
                          height={slot.height}
                          fill={'transparent'}
                          listening={true}
                          onWheel={(e) => handleImageWheel(e as unknown as Konva.KonvaEventObject<WheelEvent>, userImage.id, slot, displayWidth, displayHeight)}
                          onClick={() => {
                            selectImage(userImage.id, slot.id);
                          }}
                          onTap={() => {
                            // 모바일 탭에서도 동일 동작
                            selectImage(userImage.id, slot.id);
                          }}
                          onTouchStart={(e) => handleImageTouchStart(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id, slot, displayWidth, displayHeight)}
                          onTouchMove={(e) => handleImageTouchMove(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id)}
                          onTouchEnd={(e) => handleImageTouchEnd(e as unknown as Konva.KonvaEventObject<TouchEvent>)}
                        />
                        {console.log('[render] image', { id: userImage.id, slot: slot.id, sx: uScaleX, sy: uScaleY, x: centerX, y: centerY })}
                        <KonvaImage
                          key={userImage.id}
                          image={loadedImg}
                          x={centerX}
                          y={centerY}
                          width={displayWidth}
                          height={displayHeight}
                          scaleX={uScaleX}
                          scaleY={uScaleY}
                          rotation={uRotation}
                          draggable={!exportMode && isSelectedImage}
                          onClick={() => {
                            selectImage(userImage.id, slot.id);
                          }}
                          onTap={() => {
                            selectImage(userImage.id, slot.id);
                          }}
                          onMouseEnter={() => {
                            setStageCursor(isSelectedImage ? "grab" : "pointer");
                          }}
                          onMouseLeave={() => {
                            setStageCursor("default");
                          }}
                          onDragStart={() => {
                            selectImage(userImage.id, slot.id);
                            setStageCursor("grabbing");
                          }}
                          onWheel={(e) => handleImageWheel(e, userImage.id, slot, displayWidth, displayHeight)}
                          onTouchStart={(e) => handleImageTouchStart(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id, slot, displayWidth, displayHeight)}
                          onTouchMove={(e) => handleImageTouchMove(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id)}
                          onTouchEnd={(e) => handleImageTouchEnd(e as unknown as Konva.KonvaEventObject<TouchEvent>)}
                          onDragMove={(e) => handleImageDragMove(e, userImage.id, slot, displayWidth, displayHeight)}
                          onDragEnd={(e) => {
                            setStageCursor("grab");
                            // 드래그 종료 시 최종 위치 계산 및 상태 업데이트
                            const finalX = e.target.x();
                            const finalY = e.target.y();

                            // NaN 체크
                            if (isNaN(finalX) || isNaN(finalY)) return;

                            const newX = finalX - slot.x - (slot.width - displayWidth) / 2;
                            const newY = finalY - slot.y - (slot.height - displayHeight) / 2;

                            // 최종 NaN 체크
                            if (!isNaN(newX) && !isNaN(newY)) {
                              handleImageTransform(userImage.id, { x: newX, y: newY });
                            }
                          }}
                          onTransformEnd={(e) => {
                            const node = e.target;
                            handleImageTransform(userImage.id, {
                              scaleX: node.scaleX(),
                              scaleY: node.scaleY(),
                              rotation: node.rotation()
                            });
                          }}
                        />
                      </Group>
                    );
                  }

                  return null;
                })}
              </Layer>

              {/* 가이드라인 레이어 (프레임 위에 표시) */}
              {!exportMode && (
                <Layer>
                  {/* 프레임 전체 중앙선 */}
                  {(() => {
                    const isHorizontal = Boolean(selectedFrame && /v$/.test(selectedFrame));
                    const centerX = frameLayout.canvasWidth / 2;
                    const centerY = frameLayout.canvasHeight / 2;

                    if (isHorizontal) {
                      // 가로 프레임: 가로 중앙에 세로선 그리기
                      return (
                        <Line
                          points={[centerX, 0, centerX, frameLayout.canvasHeight]}
                          stroke="rgba(128, 128, 128, 0.5)"
                          strokeWidth={1}
                          listening={false}
                        />
                      );
                    } else {
                      // 세로 프레임: 세로 중앙에 가로선 그리기
                      return (
                        <Line
                          points={[0, centerY, frameLayout.canvasWidth, centerY]}
                          stroke="rgba(128, 128, 128, 0.5)"
                          strokeWidth={1}
                          listening={false}
                        />
                      );
                    }
                  })()}

                  {/* 각 슬롯별 빨간색 십자선 */}
                  {frameLayout.slots.map((slot) => (
                    <Group key={`guide-${slot.id}`}>
                      {/* 가로선 - 슬롯의 세로 중앙을 가로지름 */}
                      <Line
                        points={[slot.x, slot.y + slot.height / 2, slot.x + slot.width, slot.y + slot.height / 2]}
                        stroke="red"
                        strokeWidth={0.5}
                        dash={[10, 20]}
                        listening={false}
                      />
                      {/* 세로선 - 슬롯의 가로 중앙을 가로지름 */}
                      <Line
                        points={[slot.x + slot.width / 2, slot.y, slot.x + slot.width / 2, slot.y + slot.height]}
                        stroke="red"
                        strokeWidth={0.5}
                        dash={[10, 20]}
                        listening={false}
                      />
                    </Group>
                  ))}
                </Layer>
              )}

              {/* 슬롯 인터랙션 레이어 */}
              <Layer>
                {frameLayout.slots.map((slot) => {
                  const userImage = userImages.find(img => img.slotId === slot.id);
                  const hasImage = userImage && loadedImages.get(userImage.id);
                  const isSelected = selectedSlot === slot.id;

                  return (
                    <Group key={slot.id}>
                      {/* 슬롯 배경 (드롭 존) - 이미지가 있을 때는 투명하게 */}
                      <Rect
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        fill={exportMode ? 'transparent' : (hasImage ? 'transparent' : (draggedSlotId === slot.id ? 'rgba(0, 123, 255, 0.2)' : 'rgba(200, 200, 200, 0.3)'))}
                        stroke={exportMode ? 'transparent' : (hasImage ? 'transparent' : (isSelected ? 'transparent' : (draggedSlotId === slot.id ? '#007bff' : '#ccc')))}
                        strokeWidth={exportMode ? 0 : (isSelected ? 0 : 2)}
                        listening={!hasImage} // 이미지가 있을 때는 클릭 이벤트 비활성화
                        onMouseEnter={() => {
                          if (!hasImage) {
                            console.log('🔥 Slot mouse enter:', slot.id);
                            setDraggedSlotId(slot.id);
                            currentSlotIdRef.current = slot.id;
                          }
                        }}
                        onMouseLeave={() => {
                          if (!hasImage) {
                            console.log('🔥 Slot mouse leave:', slot.id);
                            setDraggedSlotId(null);
                          }
                        }}
                        onClick={(e) => {
                          if (!hasImage) {
                            console.log('🔥 Slot clicked!!! slot.id:', slot.id);
                            console.log('🔥 Click event:', e);
                            handleSlotClick(slot.id);
                          }
                        }}
                        onTap={() => {
                          if (!hasImage) {
                            // 모바일 탭 시 파일 선택 실행
                            handleSlotClick(slot.id);
                          }
                        }}
                        onTouchStart={() => {
                          if (!hasImage) {
                            // 일부 브라우저(구형 iOS) 호환을 위한 폴백
                            currentSlotIdRef.current = slot.id;
                          }
                        }}
                      />

                      {/* 슬롯 선택 표시 (캔버스 점선 바탕과 확연히 구분되도록 안쪽으로 들여서 3D Neo-Brutalism 테두리 그리기) */}
                      {!exportMode && isSelected && (
                        <Group listening={false}>
                          {/* 1. 그림자 (검은색 테두리) - 우측 하단으로 오프셋 */}
                          <Rect
                            x={slot.x + 8}
                            y={slot.y + 8}
                            width={slot.width - 16}
                            height={slot.height - 16}
                            fill="transparent"
                            stroke="black"
                            strokeWidth={4}
                          />
                          {/* 2. 메인 박스 (흰색 바탕의 주황색 테두리) */}
                          <Rect
                            x={slot.x + 6}
                            y={slot.y + 6}
                            width={slot.width - 16}
                            height={slot.height - 16}
                            fill="transparent"
                            stroke="white"
                            strokeWidth={4}
                          />
                          <Rect
                            x={slot.x + 6}
                            y={slot.y + 6}
                            width={slot.width - 16}
                            height={slot.height - 16}
                            fill="transparent"
                            stroke="#ff6b35"
                            strokeWidth={2}
                          />
                          {/* 3. 모서리 앵커 (Neo-Brutalism 스타일) */}
                          {[
                            { x: slot.x + 6, y: slot.y + 6 },
                            { x: slot.x + slot.width - 10, y: slot.y + 6 },
                            { x: slot.x + 6, y: slot.y + slot.height - 10 },
                            { x: slot.x + slot.width - 10, y: slot.y + slot.height - 10 },
                          ].map((pos, i) => (
                            <Group key={i}>
                              <Rect
                                x={pos.x - 4}
                                y={pos.y - 4}
                                width={12}
                                height={12}
                                fill="black"
                              />
                              <Rect
                                x={pos.x - 6}
                                y={pos.y - 6}
                                width={12}
                                height={12}
                                fill="white"
                                stroke="#ff6b35"
                                strokeWidth={2}
                              />
                            </Group>
                          ))}
                        </Group>
                      )}

                      {/* 슬롯 레이블 */}
                      {!hasImage && !exportMode && (() => {
                        let labelText = "클릭해서 이미지 추가";
                        if (userImage && loadedImages.get(userImage.id) === null) {
                          labelText = "이미지 로딩 실패";
                        } else if (userImage && !loadedImages.get(userImage.id)) {
                          labelText = "이미지 로딩 중...";
                        }

                        return (
                          <Group>
                            <Rect
                              x={slot.x + slot.width / 2 - 60}
                              y={slot.y + slot.height / 2 - 10}
                              width={140}
                              height={30}
                              fill="rgba(0, 0, 0, 0.7)"
                              cornerRadius={10}
                            />
                            <Text
                              x={slot.x + slot.width / 2 - 60}
                              y={slot.y + slot.height / 2 - 2}
                              width={140}
                              text={labelText}
                              fontSize={14}
                              fill="white"
                              align="center"
                            />
                          </Group>
                        );
                      })()}
                    </Group>
                  )
                })}
              </Layer>

              {/* 스티커 레이어 (텍스트 레이어 직전에 표시) */}
              <Layer>
                {stickers.map((sticker) => {
                  const isSelected = selection === sticker.id;
                  const stickerImage = loadedStickerImages.get(sticker.id) ?? null;
                  const effectiveScaleX = sticker.scaleX * (sticker.flipX ? -1 : 1);
                  const effectiveScaleY = sticker.scaleY * (sticker.flipY ? -1 : 1);

                  const tintFilter = (imageData: ImageData) => {
                    if (!sticker.tintColor) return;
                    const hex = sticker.tintColor.replace('#', '');
                    const tR = parseInt(hex.substring(0, 2), 16) / 255;
                    const tG = parseInt(hex.substring(2, 4), 16) / 255;
                    const tB = parseInt(hex.substring(4, 6), 16) / 255;
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                      data[i] = Math.round(data[i] * tR);
                      data[i + 1] = Math.round(data[i + 1] * tG);
                      data[i + 2] = Math.round(data[i + 2] * tB);
                    }
                  };

                  return (
                    <Group key={sticker.id}>
                      {stickerImage && (
                        <KonvaImage
                          ref={(node) => {
                            stickerImageRefs.current[sticker.id] = node;
                          }}
                          image={stickerImage}
                          x={sticker.x}
                          y={sticker.y}
                          width={sticker.width}
                          height={sticker.height}
                          scaleX={effectiveScaleX}
                          scaleY={effectiveScaleY}
                          offsetX={sticker.flipX ? sticker.width : 0}
                          offsetY={sticker.flipY ? sticker.height : 0}
                          rotation={sticker.rotation}
                          draggable={!exportMode && isSelected}
                          onClick={() => selectSticker(sticker.id)}
                          onTap={() => selectSticker(sticker.id)}
                          onDragStart={() => selectSticker(sticker.id)}
                          onDragMove={(e) => {
                            onStickerUpdate?.(sticker.id, {
                              x: e.target.x(),
                              y: e.target.y()
                            });
                          }}
                          filters={sticker.tintColor ? [tintFilter] : undefined}
                          onDragEnd={(e) => {
                            onStickerUpdate?.(sticker.id, {
                              x: e.target.x(),
                              y: e.target.y()
                            });
                          }}
                          onTransformEnd={() => {
                            const node = stickerImageRefs.current[sticker.id];
                            if (!node) return;

                            const rawScaleX = node.scaleX();
                            const rawScaleY = node.scaleY();
                            const appliedScaleX = Math.abs(rawScaleX) || 1;
                            const appliedScaleY = Math.abs(rawScaleY) || 1;
                            onStickerUpdate?.(sticker.id, {
                              x: node.x(),
                              y: node.y(),
                              scaleX: appliedScaleX,
                              scaleY: appliedScaleY,
                              rotation: node.rotation()
                            });
                            node.scaleX(sticker.flipX ? -appliedScaleX : appliedScaleX);
                            node.scaleY(sticker.flipY ? -appliedScaleY : appliedScaleY);
                          }}
                        />
                      )}
                      {isSelected && !exportMode && (
                        <Transformer
                          id={`transformer-${sticker.id}`}
                          flipEnabled={false}
                          borderStroke="black"
                          borderStrokeWidth={3}
                          anchorSize={12}
                          anchorStroke="black"
                          anchorStrokeWidth={3}
                          anchorFill="white"
                          anchorCornerRadius={0}
                          boundBoxFunc={(oldBox, newBox) => {
                            if (newBox.width < 10 || newBox.height < 10) {
                              return oldBox;
                            }
                            return newBox;
                          }}
                        />
                      )}
                    </Group>
                  );
                })}
              </Layer>

              {/* 텍스트 레이어 (최상위에 표시) */}
              <Layer>
                {texts.map((textItem) => {
                  const isSelected = selection === textItem.id;

                  const TextNode = () => {
                    const textRef = useRef<Konva.Text | null>(null);

                    useEffect(() => {
                      if (isSelected && textRef.current) {
                        const tr = textRef.current.getStage()?.findOne(`#transformer-text-${textItem.id}`);
                        if (tr) {
                          (tr as Konva.Transformer).nodes([textRef.current]);
                          tr.getLayer()?.batchDraw();
                        }
                      }
                    }, [isSelected]);

                    const dimensions = getTextDimensions(
                      textItem.text,
                      textItem.fontSize,
                      textItem.fontFamily,
                      textItem.isBold,
                      textItem.isItalic,
                      textItem.isVertical
                    );

                    return (
                      <Group key={textItem.id}>
                        <Text
                          ref={textRef}
                          x={textItem.x}
                          y={textItem.y}
                          width={textItem.boxWidth}
                          offsetX={textItem.boxWidth / 2}
                          offsetY={dimensions.height / 2}
                          text={formatVerticalText(textItem.text, textItem.isVertical)}
                          fontSize={textItem.fontSize}
                          fontFamily={textItem.fontFamily}
                          fill={textItem.fontColor}
                          fontStyle={`${textItem.isItalic ? 'italic ' : ''}${textItem.isBold ? 'bold' : ''}`.trim() || 'normal'}
                          align={textItem.textAlign}
                          rotation={textItem.rotation}
                          wrap="none"
                          lineHeight={textItem.isVertical ? 1.2 : 1}
                          draggable={true}
                          onClick={() => selectText(textItem.id)}
                          onTap={() => selectText(textItem.id)}
                          onDragEnd={(e) => {
                            const newX = e.target.x();
                            const newY = e.target.y();
                            onTextMove?.(textItem.id, newX, newY);
                          }}
                          onTransformEnd={() => {
                            const node = textRef.current;
                            if (!node) return;

                            const nextState = getNextTextTransformState({
                              boxWidth: textItem.boxWidth,
                              fontSize: textItem.fontSize,
                            }, {
                              x: node.x(),
                              y: node.y(),
                              rotation: node.rotation(),
                              width: node.width(),
                              scaleX: node.scaleX(),
                              scaleY: node.scaleY(),
                            });

                            onTextUpdate?.(textItem.id, nextState);
                            node.scaleX(1);
                            node.scaleY(1);
                          }}
                        />
                        {isSelected && !exportMode && (
                          <Transformer
                            id={`transformer-text-${textItem.id}`}
                            borderStroke="black"
                            borderStrokeWidth={3}
                            anchorSize={12}
                            anchorStroke="black"
                            anchorStrokeWidth={3}
                            anchorFill="white"
                            anchorCornerRadius={0}
                            keepRatio={true}
                            flipEnabled={false}
                            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                            boundBoxFunc={(oldBox, newBox) => {
                              if (newBox.width < 10 || newBox.height < 10) {
                                return oldBox;
                              }
                              return newBox;
                            }}
                          />
                        )}
                      </Group>
                    );
                  };

                  return <TextNode key={textItem.id} />;
                })}
              </Layer>
            </Stage>
          </div>
        </div>

        <div className="canvas-control-panel">
          {selectedFrame !== "1l" && (
            <div>
              <div ref={paletteAnchorRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ color: 'var(--linear-neutral-50)', fontSize: '14px' }}>프레임 색상</label>
                <button
                  ref={customPickButtonRef}
                  type="button"
                  className="linear-button linear-button--secondary"
                  style={{ height: 24, padding: '0 8px', fontSize: 12 }}
                  onClick={() => setShowCustomPalette((v) => !v)}
                  aria-expanded={showCustomPalette}
                  aria-haspopup="dialog"
                >
                  직접 선택
                </button>
                {showCustomPalette && (
                  <div
                    className="linear-card"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      padding: 8,
                      border: 'var(--border-width) solid var(--linear-neutral-500)',
                      borderRadius: '0',
                      background: 'var(--linear-neutral-600)',
                      zIndex: 20,
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    role="dialog"
                    aria-label="원형 색상 팔레트"
                  >
                    <div style={{ position: 'relative' }}>
                      <canvas
                        ref={paletteCanvasRef}
                        onClick={handlePalettePick}
                        onMouseMove={handlePaletteMove}
                        onMouseLeave={handlePaletteLeave}
                        style={{
                          display: 'block',
                          width: 160,
                          height: 160,
                          cursor: 'crosshair',
                          borderRadius: '50%',
                        }}
                      />
                      {palettePreview.visible && (
                        <div
                          style={{
                            position: 'absolute',
                            left: palettePreview.x - 16,
                            top: palettePreview.y - 16,
                            width: 32,
                            height: 32,
                            borderRadius: '0',
                            background: palettePreview.color,
                            border: 'var(--border-width) solid var(--linear-neutral-500)',
                            boxShadow: 'var(--shadow-sm)',
                            pointerEvents: 'none',
                          }}
                          aria-hidden
                          title={palettePreview.color}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* 쉬운 팔레트: 외부 설정 기반 스와치 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {presetColors.map((color) => {
                  const isSelected = color.toLowerCase() === frameColor.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`색상 ${color}`}
                      className="linear-button linear-button--secondary"
                      onClick={() => onFrameColorChange?.(color)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '0',
                        padding: 0,
                        backgroundColor: color,
                        border: isSelected ? 'var(--border-width) solid var(--linear-primary-500)' : 'var(--border-width) solid var(--linear-neutral-500)',
                        boxShadow: color.toLowerCase() === '#ffffff' ? 'var(--shadow-sm)' : 'var(--shadow-sm)',
                      }}
                      title={color}
                    />
                  );
                })}
              </div>
              {/* 기본 컬러 인풋 제거: 커스텀 원형 팔레트 사용 */}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: 'var(--linear-neutral-50)', fontSize: '18px' }}>줌:</label>
            <>
              <input
                type="number"
                className="linear-input"
                value={Math.round((selectedImage?.scaleX ?? 1) * 10)}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value) && value > 0 && selectedImage) {
                    const nextScale = Math.max(0.1, value / 10);
                    handleImageTransform(selectedImage.id, { scaleX: nextScale, scaleY: nextScale });
                  }
                }}
                min="1"
                step="5"
                style={{ width: '80px', fontSize: '12px', height: '24px' }}
                disabled={!selectedImage}
                title={selectedImage ? '선택된 이미지 줌(%)' : '이미지를 선택하거나 추가하세요'}
              />
              <span style={{ color: 'var(--linear-secondary-400)', fontSize: '12px' }}>%</span>
            </>
          </div>

          {/* 선택된 이미지 삭제 버튼 */}
          {selectedImage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => onImageDelete?.(selectedImage.id)}
                style={{
                  height: '24px',
                  padding: '0 12px',
                  fontSize: '12px',
                  backgroundColor: 'var(--linear-accent-error)',
                  color: 'var(--linear-accent-white)',
                  border: 'var(--border-width) solid var(--linear-neutral-500)'
                }}
                title="선택된 이미지를 삭제합니다"
              >
                선택된 이미지 삭제
              </button>
            </div>
          )}

          {/* 선택된 스티커 편집 도구 */}
          {selectedSticker && (
            <div style={{
              border: 'var(--border-width) solid var(--linear-neutral-500)',
              padding: '12px',
              background: 'var(--linear-neutral-700)',
              marginTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <h4 style={{ margin: '0', fontSize: '13px', color: 'var(--linear-neutral-50)' }}>스티커 편집</h4>

              {/* 반전 버튼 */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`linear-button ${selectedSticker.flipX ? 'linear-button--primary' : 'linear-button--secondary'}`}
                  onClick={() => onStickerUpdate?.(selectedSticker.id, { flipX: !selectedSticker.flipX })}
                  style={{
                    flex: 1,
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    border: 'var(--border-width) solid var(--linear-neutral-500)',
                  }}
                  title="좌우 반전"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="7 2 3 6 7 10" />
                    <polyline points="17 2 21 6 17 10" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                  </svg>
                  좌우
                </button>
                <button
                  type="button"
                  className={`linear-button ${selectedSticker.flipY ? 'linear-button--primary' : 'linear-button--secondary'}`}
                  onClick={() => onStickerUpdate?.(selectedSticker.id, { flipY: !selectedSticker.flipY })}
                  style={{
                    flex: 1,
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    border: 'var(--border-width) solid var(--linear-neutral-500)',
                  }}
                  title="상하 반전"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 7 6 3 10 7" />
                    <polyline points="2 17 6 21 10 17" />
                    <line x1="6" y1="3" x2="6" y2="21" />
                  </svg>
                  상하
                </button>
              </div>

              {/* 색상 틴트 */}
              <div>
                <p style={{ fontSize: '11px', color: 'var(--linear-secondary-300)', margin: '0 0 4px 0' }}>색상 변경</p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="color"
                    className="linear-input"
                    value={selectedSticker.tintColor ?? '#000000'}
                    onChange={(e) => onStickerUpdate?.(selectedSticker.id, { tintColor: e.target.value })}
                    style={{
                      width: '32px',
                      height: '32px',
                      padding: '2px',
                      border: 'var(--border-width) solid var(--linear-neutral-500)',
                      cursor: 'pointer',
                    }}
                    title="틴트 색상 선택"
                  />
                  <button
                    type="button"
                    className="linear-button linear-button--secondary"
                    onClick={() => onStickerUpdate?.(selectedSticker.id, { tintColor: null })}
                    disabled={!selectedSticker.tintColor}
                    style={{
                      flex: 1,
                      height: '32px',
                      fontSize: '11px',
                      border: 'var(--border-width) solid var(--linear-neutral-500)',
                      opacity: selectedSticker.tintColor ? 1 : 0.5,
                    }}
                    title="원래 색상으로 복원"
                  >
                    리셋
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  );
};

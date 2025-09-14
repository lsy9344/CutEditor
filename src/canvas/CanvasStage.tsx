import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Line } from "react-konva";
import Konva from "konva";
import type { Template } from "../state/types";
import type { FrameType, UserImage } from "../types/frame";
import { FRAME_LAYOUTS } from "../types/frame";

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
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
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
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
  }>) => void;
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
  onSelect,
  onSlotSelect,
  onImageUpload,
  onImageTransform,
  onFrameColorChange,
  onTextMove,
  onTextUpdate // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  // 모든 hook들을 먼저 호출 (조건부 렌더링 전에)
  const stageRef = useRef<Konva.Stage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 커스텀 컬러 팔레트 관련
  const [showCustomPalette, setShowCustomPalette] = useState(false);
  const paletteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteAnchorRef = useRef<HTMLDivElement | null>(null);
  const customPickButtonRef = useRef<HTMLButtonElement | null>(null);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement | null>>(new Map());
  const [processedFrameCanvas, setProcessedFrameCanvas] = useState<HTMLCanvasElement | null>(null);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const currentSlotIdRef = useRef<string | null>(null);
  // 빠른 선택 스와치 색상 (외부 설정으로 오버라이드 가능)
  const [presetColors, setPresetColors] = useState<string[]>([
    '#FFFFFF', // White
    '#000000', // Black
    '#E5E7EB', // Light Gray
    '#8D6E63', // Brown
    '#F4D03F', // Gold
    '#C8F7DC', // Mint
    '#CDE9FF', // Light Blue
    '#FAD2E1', // Light Pink
  ]);

  const frameLayout = selectedFrame ? FRAME_LAYOUTS[selectedFrame] : null;
  
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
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setFrameImage(img);
      img.onerror = () => setFrameImage(null);
      const src = frameLayout.imagePath;
      const bust = `${src}${src.includes("?") ? "&" : "?"}t=${Date.now()}`;
      img.src = bust;
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
    onSlotSelect?.(slotId);
    
    setDraggedSlotId(slotId);
    currentSlotIdRef.current = slotId; // ref에도 저장
    console.log('🔥 currentSlotIdRef.current set to:', currentSlotIdRef.current);
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

  const isHorizontal = Boolean(selectedFrame && /h$/.test(selectedFrame));
  const wrapperTargetHeight = isHorizontal ? Math.max(frameLayout.canvasWidth, frameLayout.canvasHeight) * zoom : undefined;

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
    <div className="linear-card linear-fade-in">
      <div
        style={{
          display: isHorizontal ? 'flex' : undefined,
          flexDirection: isHorizontal ? 'column' : undefined,
          justifyContent: isHorizontal ? 'center' : undefined,
          height: wrapperTargetHeight,
        }}
      >
        <div 
          style={{ 
            border: '2px dashed var(--linear-neutral-500)', 
            borderRadius: '0px',
            overflow: 'hidden',
            position: 'relative'
          }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
        {/* 컨트롤 패널을 캔버스 우측 중앙에 오버레이 */}
        <div style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '12px',
          borderRadius: '8px',
          zIndex: 10
        }}>
          <div>
            <div ref={paletteAnchorRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ color: 'var(--linear-neutral-50)', fontSize: '12px' }}>프레임 색상</label>
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
                    border: '1px solid var(--linear-neutral-500)',
                    borderRadius: '8px',
                    background: 'var(--linear-neutral-700)',
                    zIndex: 20,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
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
                          borderRadius: '50%',
                          background: palettePreview.color,
                          border: '2px solid var(--linear-neutral-900)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
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
                      borderRadius: '50%',
                      padding: 0,
                      backgroundColor: color,
                      border: isSelected ? '2px solid var(--linear-primary-500)' : '1px solid var(--linear-neutral-500)',
                      boxShadow: color.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px var(--linear-neutral-500)' : undefined,
                    }}
                    title={color}
                  />
                );
              })}
            </div>
            {/* 기본 컬러 인풋 제거: 커스텀 원형 팔레트 사용 */}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: 'var(--linear-neutral-50)', fontSize: '12px' }}>줌:</label>
            {(() => {
              const selectedImage = selectedSlot ? userImages.find(img => img.slotId === selectedSlot) : null;
              const currentScale = selectedImage && Number.isFinite(selectedImage.scaleX) ? (selectedImage.scaleX as number) : 1;
              return (
                <>
                  <input
                    type="number"
                    className="linear-input"
                    value={Math.round(currentScale * 10)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value > 0 && selectedImage) {
                        const nextScale = Math.max(0.1, value / 10);
                        handleImageTransform(selectedImage.id, { scaleX: nextScale, scaleY: nextScale });
                      }
                    }}
                    min="1"
                    step="5"
                    style={{ width: '60px', fontSize: '12px', height: '24px' }}
                    disabled={!selectedImage}
                    title={selectedImage ? '선택된 슬롯의 이미지 줌(%)' : '슬롯을 선택하거나 이미지를 추가하세요'}
                  />
                  <span style={{ color: 'var(--linear-secondary-400)', fontSize: '12px' }}>%</span>
                </>
              );
            })()}
          </div>
        </div>
        <Stage
          ref={(node) => {
            stageRef.current = node;
            if (stageRefExternal) {
              // 외부에서도 동일 참조를 사용할 수 있게 전달
              (stageRefExternal as React.MutableRefObject<Konva.Stage | null>).current = node;
            }
          }}
          width={frameLayout.canvasWidth * zoom}
          height={frameLayout.canvasHeight * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onClick={(e) => {
            if (e.target === e.target.getStage()) {
              onSelect?.(null);
              onSlotSelect?.(null);  // 슬롯 선택도 해제
            }
          }}
        >
          {/* 사용자 이미지 레이어 (프레임 이미지 뒤에 배치) */}
          <Layer>
            {frameLayout.slots.map((slot) => {
              const userImage = userImages.find(img => img.slotId === slot.id);
              const loadedImg = userImage ? loadedImages.get(userImage.id) : null;
              
              if (userImage && loadedImg && loadedImg !== null) {
                // 이미지를 슬롯 중앙에 배치하기 위한 계산
                const imageAspectRatio = loadedImg.width / loadedImg.height;
                const slotAspectRatio = slot.width / slot.height;
                
                let displayWidth = slot.width;
                let displayHeight = slot.height;
                
                // 비율을 유지하면서 슬롯에 맞추기 (contain)
                if (imageAspectRatio > slotAspectRatio) {
                  displayHeight = slot.width / imageAspectRatio;
                } else {
                  displayWidth = slot.height * imageAspectRatio;
                }
                
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
                        onSelect?.(userImage.id);
                        onSlotSelect?.(slot.id);
                      }}
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
                      draggable={true}
                      onClick={() => {
                        onSelect?.(userImage.id);
                        onSlotSelect?.(slot.id);
                      }}
                      onWheel={(e) => handleImageWheel(e, userImage.id, slot, displayWidth, displayHeight)}
                      onDragMove={(e) => handleImageDragMove(e, userImage.id, slot, displayWidth, displayHeight)}
                      onDragEnd={(e) => {
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

          {/* 프레임 이미지 레이어 (사용자 이미지 위에 배치) */}
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

          {/* 가이드라인 레이어 (프레임 위에 표시) */}
          {!exportMode && (
            <Layer>
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
            </Layer>
          )}

          {/* 텍스트 레이어 (프레임 위에 표시) */}
          <Layer>
            {texts.map((textItem) => {
              const isSelected = selection === textItem.id;
              return (
                <Group key={textItem.id}>
                  <Text
                    x={textItem.x}
                    y={textItem.y}
                    text={textItem.text}
                    fontSize={textItem.fontSize}
                    fontFamily={textItem.fontFamily}
                    fill={textItem.fontColor}
                    fontStyle={textItem.isItalic ? 'italic' : 'normal'}
                    draggable={true}
                    onClick={() => onSelect?.(textItem.id)}
                    onDragEnd={(e) => {
                      const newX = e.target.x();
                      const newY = e.target.y();
                      onTextMove?.(textItem.id, newX, newY);
                    }}
                  />
                  {/* 선택된 텍스트에 테두리 표시 (exportMode에서는 숨김) */}
                  {isSelected && !exportMode && (
                    <Rect
                      x={textItem.x - 2}
                      y={textItem.y - 2}
                      width={(() => {
                        // 간단한 텍스트 너비 계산 (더 정확한 방법)
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.font = `${textItem.isItalic ? 'italic ' : ''}${textItem.fontSize}px ${textItem.fontFamily}`;
                          const metrics = ctx.measureText(textItem.text);
                          return metrics.width + 4;
                        }
                        return (textItem.text.length * textItem.fontSize * 0.6) + 4;
                      })()}
                      height={textItem.fontSize + 4}
                      fill="transparent"
                      stroke="#ff6b35"
                      strokeWidth={2}
                      listening={false}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>

          {/* 슬롯 인터랙션 레이어 (최상위) */}
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
                    stroke={exportMode ? 'transparent' : (hasImage ? 'transparent' : (isSelected ? '#ff6b35' : (draggedSlotId === slot.id ? '#007bff' : '#ccc')))}
                    strokeWidth={exportMode ? 0 : (isSelected ? 3 : 2)}
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
                  />
                  
                  {/* 이미지가 있는 슬롯의 선택 표시 */}
                  {hasImage && (
                    <Rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      fill="transparent"
                      stroke={!exportMode && isSelected ? "#ff6b35" : "transparent"}
                      strokeWidth={3}
                      listening={false}
                    />
                  )}
                
                {/* 슬롯 레이블 */}
                {!hasImage && (() => {
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
                        width={120}
                        height={20}
                        fill="rgba(0, 0, 0, 0.7)"
                        cornerRadius={10}
                      />
                      <Text
                        x={slot.x + slot.width / 2 - 60}
                        y={slot.y + slot.height / 2 - 6}
                        width={120}
                        text={labelText}
                        fontSize={10}
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
        </Stage>
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

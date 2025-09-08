import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text } from "react-konva";
import Konva from "konva";
import type { Template } from "../state/types";
import type { FrameType, UserImage } from "../types/frame";
import { FRAME_LAYOUTS } from "../types/frame";

export type CanvasStageProps = {
  template: Template | null;
  selection: string | null;
  zoom: number;
  selectedFrame: FrameType | null;
  userImages: UserImage[];
  frameColor: string;
  onSelect?: (id: string | null) => void;
  onZoomChange?: (zoom: number) => void;
  onImageUpload?: (file: File, slotId: string) => void;
  onImageTransform?: (imageId: string, transform: Partial<UserImage>) => void;
  onFrameColorChange?: (color: string) => void;
};

export const CanvasStage: React.FC<CanvasStageProps> = ({ 
  zoom, 
  selectedFrame,
  userImages,
  frameColor,
  onZoomChange,
  onSelect,
  onImageUpload,
  onImageTransform,
  onFrameColorChange
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
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
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

  // 슬롯 클릭 핸들러 (파일 선택)
  const handleSlotClick = (slotId: string) => {
    console.log('🔥 handleSlotClick called with slotId:', slotId);
    console.log('🔥 fileInputRef.current:', fileInputRef.current);
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
  const handleImageTransform = (imageId: string, newAttrs: { x?: number; y?: number; scaleX?: number; scaleY?: number; rotation?: number }) => {
    if (onImageTransform) {
      onImageTransform(imageId, {
        x: newAttrs.x,
        y: newAttrs.y,
        scaleX: newAttrs.scaleX,
        scaleY: newAttrs.scaleY,
        rotation: newAttrs.rotation
      });
    }
  };

  // 이미지 휠 줌 핸들러
  const handleImageWheel = (e: Konva.KonvaEventObject<WheelEvent>, imageId: string) => {
    e.evt.preventDefault();
    const userImage = userImages.find(img => img.id === imageId);
    if (!userImage) return;

    // NaN 체크
    if (isNaN(userImage.scaleX) || isNaN(userImage.scaleY)) return;

    const scaleBy = 1.1;
    const oldScale = userImage.scaleX;
    const deltaY = e.evt.deltaY;
    
    // deltaY NaN 체크
    if (isNaN(deltaY)) return;
    
    const newScale = deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // 스케일 제한 (0.1 ~ 3.0)
    const clampedScale = Math.max(0.1, Math.min(3.0, newScale));
    
    // 최종 NaN 체크
    if (isNaN(clampedScale)) return;
    
    handleImageTransform(imageId, { scaleX: clampedScale, scaleY: clampedScale });
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
    
    const scaledWidth = displayWidth * userImage.scaleX;
    const scaledHeight = displayHeight * userImage.scaleY;
    
    // NaN 체크
    if (isNaN(scaledWidth) || isNaN(scaledHeight)) return;
    
    // 슬롯 내에서 이미지가 움직일 수 있는 범위 계산
    let minX, maxX, minY, maxY;
    
    if (scaledWidth <= slot.width) {
      // 이미지가 슬롯보다 작거나 같은 경우: 슬롯 내에서만 이동
      minX = slot.x;
      maxX = slot.x + slot.width - scaledWidth;
    } else {
      // 이미지가 슬롯보다 큰 경우: 슬롯을 완전히 덮도록 제한
      minX = slot.x + slot.width - scaledWidth;
      maxX = slot.x;
    }
    
    if (scaledHeight <= slot.height) {
      // 이미지가 슬롯보다 작거나 같은 경우: 슬롯 내에서만 이동
      minY = slot.y;
      maxY = slot.y + slot.height - scaledHeight;
    } else {
      // 이미지가 슬롯보다 큰 경우: 슬롯을 완전히 덮도록 제한
      minY = slot.y + slot.height - scaledHeight;
      maxY = slot.y;
    }
    
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
            <input
              type="number"
              className="linear-input"
              value={Math.round(zoom * 100)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value > 0 && onZoomChange) {
                  onZoomChange(value / 100);
                }
              }}
              min="10"
              max="400"
              step="10"
              style={{ width: '60px', fontSize: '12px', height: '24px' }}
            />
            <span style={{ color: 'var(--linear-secondary-400)', fontSize: '12px' }}>%</span>
          </div>
        </div>
        <Stage
          ref={stageRef}
          width={frameLayout.canvasWidth * zoom}
          height={frameLayout.canvasHeight * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onClick={(e) => {
            if (e.target === e.target.getStage()) {
              onSelect?.(null);
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
                
                // 중앙 정렬을 위한 오프셋 계산
                const centerX = slot.x + (slot.width - displayWidth) / 2 + userImage.x;
                const centerY = slot.y + (slot.height - displayHeight) / 2 + userImage.y;
                
                return (
                  <Group
                    key={slot.id}
                    clipFunc={(ctx) => {
                      // 슬롯 영역으로 클리핑
                      ctx.rect(slot.x, slot.y, slot.width, slot.height);
                    }}
                  >
                    <KonvaImage
                      key={userImage.id}
                      image={loadedImg}
                      x={centerX}
                      y={centerY}
                      width={displayWidth}
                      height={displayHeight}
                      scaleX={userImage.scaleX}
                      scaleY={userImage.scaleY}
                      rotation={userImage.rotation}
                      draggable={true}
                      onClick={() => onSelect?.(userImage.id)}
                      onWheel={(e) => handleImageWheel(e, userImage.id)}
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

          {/* 슬롯 인터랙션 레이어 (최상위) */}
          <Layer>
            {frameLayout.slots.map((slot) => {
              const userImage = userImages.find(img => img.slotId === slot.id);
              const hasImage = userImage && loadedImages.get(userImage.id);
              
              return (
                <Group key={slot.id}>
                  {/* 슬롯 배경 (드롭 존) - 이미지가 있을 때는 투명하게 */}
                  <Rect
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                    fill={hasImage ? 'transparent' : (draggedSlotId === slot.id ? 'rgba(0, 123, 255, 0.2)' : 'rgba(200, 200, 200, 0.3)')}
                    stroke={hasImage ? 'transparent' : (draggedSlotId === slot.id ? '#007bff' : '#ccc')}
                    strokeWidth={2}
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
              );
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

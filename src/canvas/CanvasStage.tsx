import React, { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Group } from "react-konva";
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
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [processedFrameCanvas, setProcessedFrameCanvas] = useState<HTMLCanvasElement | null>(null);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);

  const frameLayout = selectedFrame ? FRAME_LAYOUTS[selectedFrame] : null;
  
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
        img.src = userImage.url;
      }
    });
  }, [userImages, loadedImages]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    if (!onImageUpload) return;
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile && draggedSlotId) {
      onImageUpload(imageFile, draggedSlotId);
    }
    
    setDraggedSlotId(null);
  }, [onImageUpload, draggedSlotId]);

  // 슬롯 클릭 핸들러 (파일 선택)
  const handleSlotClick = (slotId: string) => {
    setDraggedSlotId(slotId);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && draggedSlotId && onImageUpload) {
      onImageUpload(file, draggedSlotId);
    }
    setDraggedSlotId(null);
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
            borderRadius: '8px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ color: 'var(--linear-neutral-50)', fontSize: '12px' }}>프레임 색상:</label>
            <input 
              type="color"
              className="linear-input"
              value={frameColor}
              onChange={(e) => {
                if (onFrameColorChange) {
                  onFrameColorChange(e.target.value);
                }
              }}
              style={{ width: '40px', height: '24px', padding: '2px' }}
            />
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
            
            {/* 슬롯 영역들 */}
            {frameLayout.slots.map((slot) => (
              <Group key={slot.id}>
                {/* 슬롯 배경 (드롭 존) */}
                <Rect
                  x={slot.x}
                  y={slot.y}
                  width={slot.width}
                  height={slot.height}
                  fill={draggedSlotId === slot.id ? 'rgba(0, 123, 255, 0.2)' : 'rgba(200, 200, 200, 0.3)'}
                  stroke={draggedSlotId === slot.id ? '#007bff' : '#ccc'}
                  strokeWidth={2}
                  onMouseEnter={() => setDraggedSlotId(slot.id)}
                  onMouseLeave={() => setDraggedSlotId(null)}
                  onClick={() => handleSlotClick(slot.id)}
                />
                
                {/* 사용자 이미지 */}
                {(() => {
                  const userImage = userImages.find(img => img.slotId === slot.id);
                  const loadedImg = userImage ? loadedImages.get(userImage.id) : null;
                  
                  if (userImage && loadedImg) {
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
                        onDragEnd={(e) => {
                          const newX = e.target.x() - slot.x - (slot.width - displayWidth) / 2;
                          const newY = e.target.y() - slot.y - (slot.height - displayHeight) / 2;
                          handleImageTransform(userImage.id, { x: newX, y: newY });
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
                    );
                  }
                  
                  return null;
                })()}
                
                {/* 슬롯 레이블 */}
                {!userImages.some(img => img.slotId === slot.id) && (
                  <Rect
                    x={slot.x + slot.width / 2 - 40}
                    y={slot.y + slot.height / 2 - 10}
                    width={80}
                    height={20}
                    fill="rgba(0, 0, 0, 0.7)"
                    cornerRadius={10}
                  />
                )}
              </Group>
            ))}
            
            {/* 오버레이는 제거: 프레임 이미지를 배경으로 사용 */}
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

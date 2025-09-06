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
};

export const CanvasStage: React.FC<CanvasStageProps> = ({ 
  zoom, 
  selectedFrame,
  userImages,
  onZoomChange,
  onSelect,
  onImageUpload,
  onImageTransform
}) => {
  // 모든 hook들을 먼저 호출 (조건부 렌더링 전에)
  const stageRef = useRef<Konva.Stage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
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

  return (
    <div className="linear-card linear-fade-in">
      <div className="linear-flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>캔버스</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ color: 'var(--linear-neutral-50)' }}>줌:</label>
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
            style={{ width: '80px' }}
          />
          <span style={{ color: 'var(--linear-secondary-400)' }}>%</span>
        </div>
      </div>

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
                image={frameImage}
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
                    return (
                      <KonvaImage
                        key={userImage.id}
                        image={loadedImg}
                        x={slot.x + userImage.x}
                        y={slot.y + userImage.y}
                        width={slot.width}
                        height={slot.height}
                        scaleX={userImage.scaleX}
                        scaleY={userImage.scaleY}
                        rotation={userImage.rotation}
                        draggable={true}
                        onClick={() => onSelect?.(userImage.id)}
                        onDragEnd={(e) => {
                          const newX = e.target.x() - slot.x;
                          const newY = e.target.y() - slot.y;
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

      <p style={{ marginTop: '16px', color: 'var(--linear-secondary-400)', fontSize: '14px' }}>
        슬롯을 클릭하거나 이미지를 드래그해서 업로드하세요
      </p>

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

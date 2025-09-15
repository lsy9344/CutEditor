import React, { useRef, useState } from 'react'
import Konva from 'konva'
import { SidebarLeft } from './ui/SidebarLeft'
import { CanvasStage } from './canvas/CanvasStage'
import { SidebarRight } from './ui/SidebarRight'
import { createInitialState } from './state/store'
import type { EditorState } from './state/store'
import type { FrameType, UserImage } from './types/frame'

function App() {
  const [editorState, setEditorState] = useState<EditorState>(createInitialState())
  const [texts, setTexts] = useState<Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
    isVertical: boolean;
  }>>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<boolean>(false);
  const stageRef = useRef<Konva.Stage | null>(null);

  const handleSelect = (id: string | null) => {
    setEditorState(prev => ({ ...prev, selection: id }))
    
    // 텍스트 선택 상태 업데이트
    if (id && texts.some(text => text.id === id)) {
      setSelectedTextId(id)
    } else {
      setSelectedTextId(null)
    }
  }

  const handleSlotSelect = (slotId: string | null) => {
    setEditorState(prev => ({ ...prev, selectedSlot: slotId }))
  }

  const handleFrameSelect = (frameType: FrameType | null) => {
    setEditorState(prev => {
      const changed = frameType !== prev.selectedFrame;
      return {
        ...prev,
        selectedFrame: frameType,
        // 다른 프레임 버튼 클릭 시 슬롯 이미지 초기화 및 선택 해제
        userImages: changed ? [] : prev.userImages,
        selectedSlot: changed ? null : prev.selectedSlot,
        selection: changed ? null : prev.selection,
      };
    })
    // 텍스트 및 텍스트 선택 상태 초기화
    setTexts([]);
    setSelectedTextId(null);
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
        userImages: newUserImages
      };
    });
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

  const handleZoomChange = (zoom: number) => {
    setEditorState(prev => ({ ...prev, zoom }))
  }

  const handleTextInsert = (textData: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
    isVertical: boolean;
  }) => {
    const newText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...textData,
      x: 100, // 기본 위치
      y: 100
    };
    
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
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
    isVertical: boolean;
  }>) => {
    setTexts(prev => 
      prev.map(text => 
        text.id === textId ? { ...text, ...updates } : text
      )
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
        selection: prev.selection === imageId ? null : prev.selection
      };
    });
  }

  // 내보내기: UI 오버레이 제거 상태에서 고해상도 PNG 추출
  const handleExport = async () => {
    const frameType = editorState.selectedFrame;
    if (!frameType) {
      alert('프레임을 먼저 선택해주세요.');
      return;
    }
    // 목표 해상도 계산 (docs/task/export_functionality.md: 1200 DPI, 10x15cm)
    const isHorizontal = /h$/.test(frameType);
    const targetDpi = 1200;
    const cmToPx = (cm: number) => Math.round((cm * targetDpi) / 2.54);
    const targetWidthPx = cmToPx(isHorizontal ? 15 : 10);

    // Stage 준비 및 오버레이 제거
    setExportMode(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      const stage = stageRef.current;
      if (!stage) throw new Error('Stage가 준비되지 않았습니다.');

      // 현재 Stage 크기 기준으로 pixelRatio 계산
      const stageW = stage.width();
      const ratioX = targetWidthPx / stageW;
      // 비율 차이가 있을 경우 평균치가 아닌 X 기준으로 맞추고 높이는 자연스레 스케일됨
      const pixelRatio = ratioX;

      // 고해상도 PNG 추출 (lossless)
      const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio });

      // 다운로드 트리거
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = dataUrl;
      a.download = `cut_export_${frameType}_${ts}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Export 실패:', e);
      alert('내보내기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setExportMode(false);
    }
  }

  return (
    <div className="app-container">
      <div className="app-main">
        <SidebarLeft 
          selectedFrame={editorState.selectedFrame}
          onFrameSelect={handleFrameSelect}
          frameColor={editorState.frameColor}
          onFrameColorChange={handleFrameColorChange}
        />
        <CanvasStage 
          template={editorState.template}
          selection={selectedTextId}
          selectedSlot={editorState.selectedSlot}
          zoom={editorState.zoom}
          selectedFrame={editorState.selectedFrame}
          userImages={editorState.userImages}
          frameColor={editorState.frameColor}
          exportMode={exportMode}
          stageRefExternal={stageRef}
          texts={texts}
          onSelect={handleSelect}
          onSlotSelect={handleSlotSelect}
          onZoomChange={handleZoomChange}
          onImageUpload={handleImageUpload}
          onImageTransform={handleImageTransform}
          onFrameColorChange={handleFrameColorChange}
          onTextMove={handleTextMove}
          onTextUpdate={handleTextUpdate}
          onImageDelete={handleImageDelete}
        />
        <SidebarRight 
          selectedText={selectedTextId ? texts.find(t => t.id === selectedTextId) : undefined}
          onTextInsert={handleTextInsert}
          onTextUpdate={handleTextUpdate}
          onTextDelete={handleTextDelete}
          onExport={handleExport}
        />
      </div>
      
    </div>
  )
}

export default App

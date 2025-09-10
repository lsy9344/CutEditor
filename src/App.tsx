import React, { useState } from 'react'
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
  }>>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

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
    setEditorState(prev => ({ ...prev, selectedFrame: frameType }))
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
  }>) => {
    setTexts(prev => 
      prev.map(text => 
        text.id === textId ? { ...text, ...updates } : text
      )
    );
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
          texts={texts}
          onSelect={handleSelect}
          onSlotSelect={handleSlotSelect}
          onZoomChange={handleZoomChange}
          onImageUpload={handleImageUpload}
          onImageTransform={handleImageTransform}
          onFrameColorChange={handleFrameColorChange}
          onTextMove={handleTextMove}
          onTextUpdate={handleTextUpdate}
        />
        <SidebarRight 
          selectedText={selectedTextId ? texts.find(t => t.id === selectedTextId) : undefined}
          onTextInsert={handleTextInsert}
          onTextUpdate={handleTextUpdate}
        />
      </div>
      
    </div>
  )
}

export default App

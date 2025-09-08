import React, { useState } from 'react'
import { SidebarLeft } from './ui/SidebarLeft'
import { CanvasStage } from './canvas/CanvasStage'
import { SidebarRight } from './ui/SidebarRight'
import { WizardFooter } from './ui/WizardFooter'
import { createInitialState } from './state/store'
import type { EditorState } from './state/store'
import type { FrameType, UserImage } from './types/frame'

function App() {
  const [editorState, setEditorState] = useState<EditorState>(createInitialState())

  const handleSelect = (id: string | null) => {
    setEditorState(prev => ({ ...prev, selection: id }))
  }

  const handleFrameSelect = (frameType: FrameType | null) => {
    setEditorState(prev => ({ ...prev, selectedFrame: frameType }))
  }

  const handleImageUpload = (file: File, slotId: string) => {
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
      rotation: 0
    };

    setEditorState(prev => ({
      ...prev,
      userImages: [...prev.userImages.filter(img => img.slotId !== slotId), newImage]
    }));
  }

  const handleImageTransform = (imageId: string, transform: Partial<UserImage>) => {
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
          selection={editorState.selection}
          zoom={editorState.zoom}
          selectedFrame={editorState.selectedFrame}
          userImages={editorState.userImages}
          frameColor={editorState.frameColor}
          onSelect={handleSelect}
          onZoomChange={handleZoomChange}
          onImageUpload={handleImageUpload}
          onImageTransform={handleImageTransform}
          onFrameColorChange={handleFrameColorChange}
        />
        <SidebarRight />
      </div>
      
      <WizardFooter />
    </div>
  )
}

export default App

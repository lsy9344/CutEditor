import React, { useState } from 'react'
import { SidebarLeft } from './ui/SidebarLeft'
import { CanvasStage } from './canvas/CanvasStage'
import { SidebarRight } from './ui/SidebarRight'
import { WizardFooter } from './ui/WizardFooter'
import { createInitialState } from './state/store'
import type { EditorState } from './state/store'

function App() {
  const [editorState, setEditorState] = useState<EditorState>(createInitialState())

  const handleSelect = (id: string | null) => {
    setEditorState(prev => ({ ...prev, selection: id }))
  }

  const handleFrameSelect = (frameType: string | null) => {
    setEditorState(prev => ({ ...prev, selectedFrame: frameType }))
  }

  const handleZoomChange = (zoom: number) => {
    setEditorState(prev => ({ ...prev, zoom }))
  }

  return (
    <div className="app-container">
      <div className="app-header" style={{ textAlign: 'center' }}>
        <h1>다비스튜디오 컷편집기</h1>
        <p>2/4/6/9컷 편집, 레터링</p>
      </div>
      
      <div className="app-main">
        <SidebarLeft 
          selectedFrame={editorState.selectedFrame}
          onFrameSelect={handleFrameSelect}
        />
        <CanvasStage 
          template={editorState.template}
          selection={editorState.selection}
          zoom={editorState.zoom}
          selectedFrame={editorState.selectedFrame}
          onSelect={handleSelect}
          onZoomChange={handleZoomChange}
        />
        <SidebarRight />
      </div>
      
      <WizardFooter />
    </div>
  )
}

export default App
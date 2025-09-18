import React, { useMemo, useRef, useState } from 'react'
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
  const mobileFileInputRef = useRef<HTMLInputElement | null>(null);
  // 모바일 내보내기 오버레이 상태
  const [exportOverlayOpen, setExportOverlayOpen] = useState<boolean>(false);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportObjectUrl, setExportObjectUrl] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string>("");

  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  }, []);

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

  // 모바일 전용 업로드 트리거
  const handleMobileUploadClick = () => {
    const slotId = editorState.selectedSlot;
    if (!slotId) {
      alert('이미지를 넣을 슬롯을 먼저 탭하여 선택하세요.');
      return;
    }
    mobileFileInputRef.current?.click();
  };

  const handleMobileFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const slotId = editorState.selectedSlot;
    const file = e.target.files?.[0];
    if (file && slotId) {
      handleImageUpload(file, slotId);
    }
    if (mobileFileInputRef.current) mobileFileInputRef.current.value = '';
  };

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
    x: number;
    y: number;
  }) => {
    const newText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...textData,
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
      // 모바일 메모리 한계 고려: 과도한 픽셀 비율을 제한
      const maxMobileRatio = 3; // 안전한 최대 배수 (디바이스에 따라 조정 가능)
      const pixelRatio = isMobile ? Math.min(ratioX, maxMobileRatio) : ratioX;

      // PNG DataURL 생성 후 Blob으로 변환 (모바일 메모리/호환성 고려)
      const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio });
      const blob = await fetch(dataUrl).then(r => r.blob());

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `cut_export_${frameType}_${ts}.png`;

      if (isMobile) {
        // iOS 등에서 사용자가 명시적으로 '사진에 저장'을 누를 수 있도록 오버레이 표시
        const url = URL.createObjectURL(blob);
        setExportBlob(blob);
        setExportObjectUrl(url);
        setExportFilename(filename);
        setExportOverlayOpen(true);
        return; // 오버레이에서 후속 액션 수행
      } else {
        // 데스크톱: 파일 다운로드
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    } catch (e) {
      console.error('Export 실패:', e);
      alert('내보내기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setExportMode(false);
    }
  }

  // 모바일: '사진에 저장' 버튼 핸들러 (사용자 제스처 컨텍스트 내)
  const handleMobileSaveToPhotos = async () => {
    if (!exportBlob) return;
    try {
      const file = new File([exportBlob], exportFilename || 'cut_export.png', { type: 'image/png' });
      const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator && (navigator as any).canShare?.({ files: [file] });
      if (canShareFiles && 'share' in navigator) {
        await (navigator as any).share({ files: [file], title: '컷 내보내기' });
        // 공유 완료 후 오버레이 닫기
        handleCloseExportOverlay();
        return;
      }
    } catch (err) {
      console.warn('Web Share API 실패 또는 미지원:', err);
    }

    // 폴백 1: 다운로드 시도
    try {
      const url = exportObjectUrl || URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename || 'cut_export.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    } catch (err) {
      console.warn('모바일 다운로드 폴백 실패:', err);
    }

    // 폴백 2: 같은 탭에서 이미지 열기 → 사용자 공유/저장 유도
    try {
      const url = exportObjectUrl || (exportBlob ? URL.createObjectURL(exportBlob) : undefined);
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.warn('이미지 열기 폴백 실패');
    }
  };

  const handleCloseExportOverlay = () => {
    setExportOverlayOpen(false);
    if (exportObjectUrl) {
      try { URL.revokeObjectURL(exportObjectUrl); } catch {}
    }
    setExportBlob(null);
    setExportObjectUrl(null);
    setExportFilename("");
  };

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
          selectedFrame={editorState.selectedFrame}
          selectedText={selectedTextId ? texts.find(t => t.id === selectedTextId) : undefined}
          onTextInsert={handleTextInsert}
          onTextUpdate={handleTextUpdate}
          onTextDelete={handleTextDelete}
          onExport={handleExport}
        />
      </div>
      {/* 모바일 전용: 하단 업로드 버튼 및 파일 입력 */}
      {isMobile && (
        <>
          <input
            ref={mobileFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleMobileFileChange}
          />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 12,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <button
              className="linear-button linear-button--primary"
              style={{
                pointerEvents: 'auto',
                boxShadow: 'var(--shadow)',
                borderRadius: '999px',
                padding: '0 20px',
                height: 44,
              }}
              onClick={handleMobileUploadClick}
            >
              사진 추가
            </button>
          </div>
        </>
      )}

      {/* 모바일: 내보내기 오버레이 (사진에 저장) */}
      {isMobile && exportOverlayOpen && (
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
            <p style={{ marginBottom: 12 }}>사진 앱에 저장하려면 아래 버튼을 눌러 주세요.</p>
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
                  // 이미지 열기(폴백): 같은 탭에서 열고, 사용자가 공유/저장 선택
                  if (exportObjectUrl) {
                    window.location.href = exportObjectUrl;
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

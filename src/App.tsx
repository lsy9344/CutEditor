import React, { useMemo, useRef, useState, useCallback } from 'react'
import Konva from 'konva'
import { SidebarLeft } from './ui/SidebarLeft'
import { CanvasStage } from './canvas/CanvasStage'
import { SidebarRight } from './ui/SidebarRight'
import { FrameGallery } from './canvas/FrameGallery'
import { createInitialState } from './state/store'
import type { EditorState } from './state/store'
import { FRAME_LAYOUTS, type FrameType, type UserImage } from './types/frame'
import { FRAME_OPTIONS_BY_CATEGORY } from './ui/SidebarLeft'
import {
  DEFAULT_STICKER_HEIGHT,
  DEFAULT_STICKER_WIDTH,
  getCenteredStickerPosition,
  getInitialStickerScale,
  getScaledStickerDimensions,
  loadStickerDimensions,
} from './utils/stickerSizing'
import { getFrameSelectionDecision, hasFrameContent } from './utils/frameChangeFlow'

type FileSystemWritableFileStream = {
  write: (data: Blob | BufferSource | string) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandle = {
  kind: 'file';
  name: string;
  createWritable: () => Promise<FileSystemWritableFileStream>;
  queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

type SaveFilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: SaveFilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  startIn?: FileSystemFileHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
};

type TextAlign = 'left' | 'center' | 'right';

type CanvasText = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  isItalic: boolean;
  isVertical: boolean;
  textAlign: TextAlign;
};

type CanvasSticker = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

const DEFAULT_CANVAS_WIDTH = 483;
const DEFAULT_CANVAS_HEIGHT = 719;
const TEXT_ALIGN_PADDING = 24;

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

function App() {
  const [editorState, setEditorState] = useState<EditorState>(createInitialState())
  const [canvasMode, setCanvasMode] = useState<'gallery' | 'editor'>('gallery')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [texts, setTexts] = useState<CanvasText[]>([]);
  const [stickers, setStickers] = useState<CanvasSticker[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [pendingFrameChange, setPendingFrameChange] = useState<FrameType | null>(null);
  const [exportMode, setExportMode] = useState<boolean>(false);
  const stageRef = useRef<Konva.Stage | null>(null);
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

  const supportsFilePicker = useMemo(() => (
    typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
  ), []);

  const handleSelect = (id: string | null) => {
    setEditorState(prev => ({ ...prev, selection: id }))

    // 텍스트/스티커 선택 상태 업데이트
    if (id && texts.some(text => text.id === id)) {
      setSelectedTextId(id);
      setSelectedStickerId(null);
    } else if (id && stickers.some(sticker => sticker.id === id)) {
      setSelectedStickerId(id);
      setSelectedTextId(null);
    } else {
      setSelectedTextId(null);
      setSelectedStickerId(null);
    }
  }

  const handleSlotSelect = (slotId: string | null) => {
    setEditorState(prev => ({ ...prev, selectedSlot: slotId }))
  }

  const applyFrameChange = (frameType: FrameType) => {
    setEditorState(prev => {
      return {
        ...prev,
        selectedFrame: frameType,
        userImages: [],
        selectedSlot: null,
        selection: null,
      };
    });
    // 텍스트 및 스티커 선택 상태 초기화
    setTexts([]);
    setStickers([]);
    setSelectedTextId(null);
    setSelectedStickerId(null);
    setPendingFrameChange(null);
    setCanvasMode('editor');
  };

  const handleFrameSelect = (rawFrameType: string | null) => {
    const decision = getFrameSelectionDecision({
      rawFrameType,
      selectedFrame: editorState.selectedFrame,
      hasContent: hasFrameContent({
        textCount: texts.length,
        stickerCount: stickers.length,
        userImageCount: editorState.userImages.length,
      }),
    });

    if (decision.kind === 'noop') return;
    if (decision.kind === 'activate-editor') {
      setPendingFrameChange(null);
      setCanvasMode('editor');
      return;
    }
    if (decision.kind === 'confirm') {
      setPendingFrameChange(decision.frameType);
      return;
    }

    applyFrameChange(decision.frameType);
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

  const makeSuggestedFilename = useCallback(() => {
    const frameType = editorState.selectedFrame ?? 'preview';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `cut_export_${frameType}_${ts}.png`;
  }, [editorState.selectedFrame]);

  const handleZoomChange = (zoom: number) => {
    setEditorState(prev => ({ ...prev, zoom }))
  }

  const getCanvasWidth = useCallback(() => {
    if (!editorState.selectedFrame) {
      return DEFAULT_CANVAS_WIDTH;
    }
    return FRAME_LAYOUTS[editorState.selectedFrame].canvasWidth;
  }, [editorState.selectedFrame]);

  const getTextWidth = useCallback((textItem: CanvasText) => {
    if (textItem.isVertical) {
      return Math.max(textItem.fontSize * 0.6, 1);
    }

    if (typeof document === 'undefined') {
      const lines = textItem.text.split('\n');
      const maxLen = Math.max(...lines.map(l => l.length));
      return Math.max(maxLen * textItem.fontSize * 0.6, 1);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const lines = textItem.text.split('\n');
      const maxLen = Math.max(...lines.map(l => l.length));
      return Math.max(maxLen * textItem.fontSize * 0.6, 1);
    }

    ctx.font = `${textItem.isItalic ? 'italic ' : ''}${textItem.fontSize}px ${textItem.fontFamily}`;
    const lines = textItem.text.split('\n');
    let maxWidth = 1;
    lines.forEach(line => {
      const text = line.length > 0 ? line : ' ';
      const width = ctx.measureText(text).width;
      if (width > maxWidth) maxWidth = width;
    });

    return maxWidth;
  }, []);

  const getAlignedTextX = useCallback((textItem: CanvasText, align: TextAlign) => {
    const canvasWidth = getCanvasWidth();
    const textWidth = getTextWidth(textItem);
    const halfWidth = textWidth / 2;

    let targetX = textItem.x;
    if (align === 'left') {
      targetX = TEXT_ALIGN_PADDING + halfWidth;
    } else if (align === 'center') {
      targetX = canvasWidth / 2;
    } else {
      targetX = canvasWidth - TEXT_ALIGN_PADDING - halfWidth;
    }

    const minX = halfWidth;
    const maxX = canvasWidth - halfWidth;
    if (minX > maxX) {
      return canvasWidth / 2;
    }
    return Math.min(maxX, Math.max(minX, targetX));
  }, [getCanvasWidth, getTextWidth]);

  const handleTextInsert = (textData: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: TextAlign;
    x: number;
    y: number;
  }) => {
    const newText: CanvasText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...textData,
    };
    newText.x = getAlignedTextX(newText, newText.textAlign);

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
    textAlign: TextAlign;
  }>) => {
    setTexts(prev =>
      prev.map(text => {
        if (text.id !== textId) {
          return text;
        }

        const updatedText: CanvasText = { ...text, ...updates };
        const widthRelatedUpdated =
          updates.text !== undefined ||
          updates.fontSize !== undefined ||
          updates.fontFamily !== undefined ||
          updates.isItalic !== undefined ||
          updates.isVertical !== undefined;

        const shouldRealign =
          updates.textAlign !== undefined ||
          (updatedText.textAlign !== 'center' && widthRelatedUpdated);

        if (shouldRealign) {
          updatedText.x = getAlignedTextX(updatedText, updatedText.textAlign);
        }

        return updatedText;
      })
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

  const handleStickerInsert = async (src: string) => {
    const { width, height } = await loadStickerDimensions(src, {
      fallbackWidth: DEFAULT_STICKER_WIDTH,
      fallbackHeight: DEFAULT_STICKER_HEIGHT,
    });
    const initialScale = getInitialStickerScale({ width, height });
    const displayDimensions = getScaledStickerDimensions({
      width,
      height,
      scale: initialScale,
    });

    const selectedFrameLayout = editorState.selectedFrame
      ? FRAME_LAYOUTS[editorState.selectedFrame]
      : null;

    const { x, y } = getCenteredStickerPosition({
      canvasWidth: selectedFrameLayout?.canvasWidth ?? DEFAULT_CANVAS_WIDTH,
      canvasHeight: selectedFrameLayout?.canvasHeight ?? DEFAULT_CANVAS_HEIGHT,
      stickerWidth: displayDimensions.width,
      stickerHeight: displayDimensions.height,
    });

    const newSticker: CanvasSticker = {
      id: `sticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      src,
      x,
      y,
      width,
      height,
      scaleX: initialScale,
      scaleY: initialScale,
      rotation: 0
    };

    setStickers(prev => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setSelectedTextId(null); // Text 선택 해제
    setEditorState(prev => ({ ...prev, selection: newSticker.id }));
  }

  const handleStickerUpdate = (stickerId: string, updates: Partial<CanvasSticker>) => {
    setStickers(prev =>
      prev.map(sticker => {
        if (sticker.id === stickerId) {
          return { ...sticker, ...updates };
        }
        return sticker;
      })
    );
  }

  const handleStickerDelete = (stickerId: string) => {
    setStickers(prev => prev.filter(sticker => sticker.id !== stickerId));

    if (selectedStickerId === stickerId) {
      setSelectedStickerId(null);
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

      const filename = makeSuggestedFilename();

      if (isMobile) {
        // iOS 등에서 사용자가 명시적으로 '사진에 저장'을 누를 수 있도록 오버레이 표시
        const url = URL.createObjectURL(blob);
        setExportBlob(blob);
        setExportObjectUrl(url);
        setExportFilename(filename);
        setExportOverlayOpen(true);
        return; // 오버레이에서 후속 액션 수행
      }

      if (supportsFilePicker && window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            excludeAcceptAllOption: true,
            startIn: 'desktop',
            types: [
              {
                description: 'PNG 이미지',
                accept: { 'image/png': ['.png'] },
              },
            ],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (error) {
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          if (!isAbort) {
            console.warn('파일 저장 위치 선택 실패', error);
            alert('파일 저장 위치를 선택하지 못했습니다. 다운로드로 전환합니다.');
          }
        }
      }

      // 파일 시스템 접근 API 미지원 또는 취소 시 기본 다운로드로 폴백
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
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
      const nav = navigator as unknown as { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title: string }) => Promise<void> };
      const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator && nav.canShare?.({ files: [file] });
      if (canShareFiles && 'share' in navigator) {
        await nav.share?.({ files: [file], title: '컷 내보내기' });
        // 공유 완료 후 오버레이 닫기
        handleCloseExportOverlay();
        return;
      }
    } catch {
      console.warn('Web Share API 실패 또는 미지원');
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
    } catch {
      console.warn('모바일 다운로드 폴백 실패');
    }

    // 폴백 2: 같은 탭에서 이미지 열기 → 사용자 공유/저장 유도
    try {
      const url = exportObjectUrl || (exportBlob ? URL.createObjectURL(exportBlob) : undefined);
      if (url) {
        window.location.href = url;
      }
    } catch {
      console.warn('이미지 열기 폴백 실패');
    }
  };

  const handleCloseExportOverlay = () => {
    setExportOverlayOpen(false);
    if (exportObjectUrl) {
      try {
        URL.revokeObjectURL(exportObjectUrl);
      } catch {
        // 무시
      }
    }
    setExportBlob(null);
    setExportObjectUrl(null);
    setExportFilename("");
  };

  const activeCategory = selectedCategory || Object.keys(FRAME_OPTIONS_BY_CATEGORY).find(cat =>
    FRAME_OPTIONS_BY_CATEGORY[cat].some(opt => opt.value === editorState.selectedFrame)
  ) || null;

  const availableOptions = activeCategory ? FRAME_OPTIONS_BY_CATEGORY[activeCategory] : [];

  return (
    <div className="app-container">
      <div className="app-main">
        <SidebarLeft
          selectedFrame={editorState.selectedFrame}
          onFrameSelect={handleFrameSelect}
          frameColor={editorState.frameColor}
          onFrameColorChange={handleFrameColorChange}
          canvasMode={canvasMode}
          onCanvasModeChange={setCanvasMode}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        {canvasMode === 'gallery' ? (
          <FrameGallery
            selectedCategory={activeCategory}
            options={availableOptions}
            onSelectFrame={handleFrameSelect}
          />
        ) : (
          <CanvasStage
            template={editorState.template}
            selection={selectedTextId || selectedStickerId}
            selectedSlot={editorState.selectedSlot}
            zoom={editorState.zoom}
            selectedFrame={editorState.selectedFrame}
            userImages={editorState.userImages}
            frameColor={editorState.frameColor}
            exportMode={exportMode}
            stageRefExternal={stageRef}
            texts={texts}
            stickers={stickers}
            onSelect={handleSelect}
            onSlotSelect={handleSlotSelect}
            onZoomChange={handleZoomChange}
            onImageUpload={handleImageUpload}
            onImageTransform={handleImageTransform}
            onFrameColorChange={handleFrameColorChange}
            onTextMove={handleTextMove}
            onTextUpdate={handleTextUpdate}
            onImageDelete={handleImageDelete}
            onStickerUpdate={handleStickerUpdate}
          />
        )}
        <SidebarRight
          selectedFrame={editorState.selectedFrame}
          selectedText={selectedTextId ? texts.find(t => t.id === selectedTextId) : undefined}
          selectedSticker={selectedStickerId ? stickers.find(s => s.id === selectedStickerId) : undefined}
          onTextInsert={handleTextInsert}
          onTextUpdate={handleTextUpdate}
          onTextDelete={handleTextDelete}
          onStickerInsert={handleStickerInsert}
          onStickerDelete={handleStickerDelete}
          onExport={handleExport}
        />
      </div>

      {pendingFrameChange && (
        <div
          role="dialog"
          aria-modal="true"
          className="linear-fade-in"
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
          onClick={() => setPendingFrameChange(null)}
        >
          <div
            className="linear-card"
            style={{
              width: 'min(480px, 100%)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: '0',
              border: 'var(--border-width) solid var(--linear-neutral-500)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ margin: 0 }}>프레임 변경 확인</h3>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                프레임을 변경하면 디자인 캔버스의 모든 편집 내용이 초기화됩니다.
                <br />
                {FRAME_LAYOUTS[pendingFrameChange].name} 프레임으로 변경하시겠습니까?
              </p>
              <div className="linear-flex" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="linear-button linear-button--secondary"
                  onClick={() => setPendingFrameChange(null)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="linear-button linear-button--primary"
                  onClick={() => applyFrameChange(pendingFrameChange)}
                >
                  변경
                </button>
              </div>
            </div>
          </div>
        </div>
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

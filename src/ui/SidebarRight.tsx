import React, { useState, useRef, useEffect } from "react";
import { useFonts } from "../hooks/useFonts";
import type { FrameType } from "../types/frame";

export type SidebarRightProps = {
  selectedFrame?: FrameType | null;
  selectedText?: {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
    isVertical: boolean;
  };
  onTextInsert?: (textData: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
    isVertical: boolean;
    x: number;
    y: number;
  }) => void;
  onTextUpdate?: (textId: string, updates: Partial<{
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isItalic: boolean;
    isVertical: boolean;
  }>) => void;
  onTextDelete?: (textId: string) => void;
  onExport?: () => void;
};

export const SidebarRight: React.FC<SidebarRightProps> = ({
  selectedFrame,
  selectedText,
  onTextInsert,
  onTextUpdate,
  onTextDelete,
  onExport
}) => {
  const [textInput, setTextInput] = useState("");
  const [textSize, setTextSize] = useState(16);
  const [isItalic, setIsItalic] = useState(true);
  const [isVertical, setIsVertical] = useState(false);
  const [fontFamily, setFontFamily] = useState("");
  const [isFontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontColor, setFontColor] = useState("#000000");
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  
  // 동적 폰트 로딩
  const { fonts, isLoading: fontsLoading } = useFonts();

  // 폰트 목록이 로딩되면, 선택된 텍스트가 없을 때 Aritaburi을 기본값으로 설정
  useEffect(() => {
    if (!fontsLoading && fonts.length > 0 && !selectedText) {
      const names = fonts.map(f => f.name);
      if (!names.includes(fontFamily)) {
        // Aritaburi이 있으면 기본값으로 사용, 없으면 첫 번째 폰트 사용
        const defaultFont = names.includes('Aritaburi') ? 'Aritaburi' : names[0];
        setFontFamily(defaultFont);
      }
    }
  }, [fontsLoading, fonts, selectedText]);

  // 선택된 텍스트가 변경될 때 입력창에 동기화
  useEffect(() => {
    if (selectedText) {
      setTextInput(selectedText.text);
    }
  }, [selectedText]);

  // 고정 미리보기 문구
  const fontPreviewText = '내 세상은 네가 있어 더 아름다워♥, 2025.09.13';

  // 프레임별 기본 텍스트 위치
  const getDefaultTextPosition = (frameType: FrameType | null): { x: number; y: number } => {
    switch (frameType) {
      case "1l": // 1컷 레터링
        return { x: 241.5, y: 100 };

      case "1f": // 1컷 프레임
        return { x: 241.5, y: 665 };

      case "2h": // 2컷 가로
        return { x: 620, y: 241.5 };

      case "2v": // 2컷 세로
        return { x: 241.5, y: 630 };

      case "4v": // 4컷
        return { x: 241.5, y: 660 };

      case "6v": // 6컷
        return { x: 241.5, y: 660 };

      case "9v": // 9컷
        return { x: 241.5, y: 645 };

      default:
        return { x: 10, y: 10 };
    }
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!isFontPickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFontPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFontPickerOpen]);

  // 선택된 텍스트의 속성을 표시
  const displayedTextSize = selectedText?.fontSize ?? textSize;
  const displayedFontFamily = selectedText?.fontFamily ?? fontFamily;
  const displayedFontColor = selectedText?.fontColor ?? fontColor;
  const displayedIsItalic = selectedText?.isItalic ?? isItalic;
  const displayedIsVertical = selectedText?.isVertical ?? isVertical;


  const handleDescriptionSelect = (value: string) => {
    if (textInputRef.current) {
      setTextInput(value);
      textInputRef.current.value = value;
      textInputRef.current.focus();
    }
  };

  const handleTextInsert = () => {
    if (!textInput.trim()) {
      alert("텍스트를 입력해주세요.");
      return;
    }

    // 프레임별 위치 설정
    const { x, y } = getDefaultTextPosition(selectedFrame ?? null);

    // 항상 새 텍스트 삽입
    onTextInsert?.({
      text: textInput,
      fontSize: textSize,
      fontFamily,
      fontColor,
      isItalic,
      isVertical,
      x,
      y,
    });
  };

  const handleTextSizeChange = (newSize: number) => {
    setTextSize(newSize);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { fontSize: newSize });
    }
  };

  const handleFontFamilyChange = (newFontFamily: string) => {
    setFontFamily(newFontFamily);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { fontFamily: newFontFamily });
    }
  };

  const handleFontColorChange = (newColor: string) => {
    setFontColor(newColor);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { fontColor: newColor });
    }
  };

  const handleItalicToggle = () => {
    const newIsItalic = !displayedIsItalic;
    setIsItalic(newIsItalic);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { isItalic: newIsItalic });
    }
  };

  const handleVerticalToggle = () => {
    const newIsVertical = !displayedIsVertical;
    setIsVertical(newIsVertical);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { isVertical: newIsVertical });
    }
  };

  const handleTextDelete = () => {
    if (!selectedText) {
      alert("삭제할 텍스트를 먼저 선택해주세요.");
      return;
    }
    
    if (confirm(`"${selectedText.text}" 텍스트를 삭제하시겠습니까?`)) {
      onTextDelete?.(selectedText.id);
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--linear-space-2)' }}>
      {/* 첫 번째 카드: 텍스트 입력 및 추천 */}
      <aside className="linear-card">
        <h3>사진에 글씨 새기기</h3>
        <div className="linear-grid linear-mt-4" style={{ gridTemplateColumns: "1fr" }}>
          {/* 텍스트 입력 영역 */}
          <label>
            <p style={{ fontSize: "var(--linear-text-xs)" }}>
              텍스트를 입력하세요.
            </p>
            <textarea
              ref={textInputRef as React.RefObject<HTMLTextAreaElement>}
              className="linear-input"
              style={{ 
                width: '90%', 
                borderColor: 'var(--linear-neutral-300)',
                minHeight: '100px',
                resize: 'vertical',
                marginTop: 'var(--linear-space-1)'
              }}
              placeholder="예) 너의 100일을 축하해 :)"
              value={textInput}
              onChange={(e) => {
                const newValue = e.target.value;
                setTextInput(newValue);

                // 선택된 텍스트가 있으면 실시간으로 캔버스에 반영
                if (selectedText && onTextUpdate) {
                  onTextUpdate(selectedText.id, { text: newValue });
                }
              }}
            />
          </label>
          
          <label>
            <p style={{ fontSize: "var(--linear-text-xs)" }}>
              레터링을 추천해 드릴게요 :)
            </p>
            <select 
              className="linear-select"
              style={{ 
                borderColor: 'var(--linear-neutral-300)',
                marginTop: 'var(--linear-space-1)'
              }}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleDescriptionSelect(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>클릭해서 추천받기</option>
              <option value="다비야, 너의 1000일을 축하해 :)">다비야, 너의 1000일을 축하해 :)</option>
              <option value="평생 함께 해♥">평생 함께 해♥</option>
              <option value="내 세상은 네가 있어 더 아름다워">내 세상은 네가 있어 더 아름다워</option>
              <option value="우리집 둘 째">우리집 둘 째</option>
              <option value="우리 곧, 결혼해요.">우리 곧, 결혼해요.</option>
              <option value="우리 셋의 세 번째 크리스마스">우리 셋의 세 번째 크리스마스</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
            </select>
          </label>
          
          <div className="linear-flex linear-mt-4">
            <button
              className="linear-button linear-button--secondary"
              onClick={handleTextDelete}
              disabled={!selectedText}
              style={{
                opacity: selectedText ? 1 : 0.5,
                cursor: selectedText ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                height: '48px',
                border: '1px solid var(--linear-neutral-500)',
                width: '100%'
              }}
            >
              삭제
            </button>
            <button
              className="linear-button linear-button--primary"
              onClick={handleTextInsert}
              style={{
                fontSize: '14px',
                height: '48px',
                border: '1px solid var(--linear-neutral-500)',
                width: '100%'
              }}
            >
              삽입
            </button>
          </div>
        </div>
      </aside>

      {/* 두 번째 카드: 텍스트 스타일 설정 */}
      <aside className="linear-card">
        <div className="linear-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--linear-space-2)" }}>
          {/* 상단 왼쪽: 글자 크기 */}
          <label>
            <p style={{ fontSize: "var(--linear-text-xs)" }}>
              폰트 크기
            </p>
            <input 
              type="number"
              className="linear-input"
              style={{ 
                borderColor: 'var(--linear-neutral-300)', 
                width: '40px',
                marginTop: 'var(--linear-space-1)'
              }}
              value={displayedTextSize}
              onChange={(e) => handleTextSizeChange(Number(e.target.value))}
              min="1"
              max="99"
              placeholder="16"
            />
          </label>
          
          {/* 상단 오른쪽: 폰트 (모달 트리거) */}
          <label>
            <p style={{ fontSize: "var(--linear-text-xs)" }}>
              폰트 선택
            </p>
            <div className="linear-flex" style={{ alignItems: 'center' }}>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => !fontsLoading && setFontPickerOpen(true)}
                disabled={fontsLoading}
                title={fontsLoading ? '폰트 로딩 중' : '폰트 선택'}
                style={{
                  border: '1px solid var(--linear-neutral-400)',
                  padding: '6px 10px',
                  fontSize: '14px',
                  fontFamily: displayedFontFamily || 'var(--linear-font-family)',
                  width: '100%',
                  marginTop: 'var(--linear-space-1)'
                }}
              >
                {fontsLoading ? '폰트 로딩 중…' : (displayedFontFamily || '폰트 선택')}
              </button>
            </div>
          </label>
        
          {/* 하단 왼쪽: 폰트색상 */}
          <label>
            <p style={{ fontSize: "var(--linear-text-xs)" }}>
              폰트 색상
            </p>
            <input 
              type="color"
              className="linear-input"
              style={{ 
                borderColor: 'var(--linear-neutral-300)',
                width: '60px',
                height: '36px',
                padding: '2px',
                marginTop: 'var(--linear-space-1)'
              }}
              value={displayedFontColor}
              onChange={(e) => handleFontColorChange(e.target.value)}
            />
          </label>
          
          {/* 하단 오른쪽: 기울임 + 세로 정렬 */}
          <label>
            <p style={{ fontSize: "var(--linear-text-xs)" }}>
              폰트 스타일
            </p>
            <div style={{ display: 'flex', gap: '6px', marginTop: 'var(--linear-space-1)' }}>
              <button
                className={`linear-button ${displayedIsItalic ? 'linear-button--primary' : 'linear-button--secondary'}`}
                onClick={handleItalicToggle}
                title="기울임"
                style={{
                  width: '100%',
                  height: '36px',
                  border: displayedIsItalic 
                    ? '1px solid var(--linear-primary-500)' 
                    : '1px solid var(--linear-neutral-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                기울임
              </button>
              <button
                className={`linear-button ${displayedIsVertical ? 'linear-button--primary' : 'linear-button--secondary'}`}
                onClick={handleVerticalToggle}
                title="세로쓰기"
                style={{
                  width: '100%',
                  height: '36px',
                  border: displayedIsVertical 
                    ? '1px solid var(--linear-primary-500)' 
                    : '1px solid var(--linear-neutral-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                세로쓰기
              </button>
            </div>
          </label>
        </div>
      </aside>

      {/* 폰트 선택 모달 */}
      {isFontPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="linear-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--linear-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setFontPickerOpen(false)}
        >
          <div
            className="linear-card"
            style={{
              width: 'min(720px, 90vw)',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="linear-flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>폰트 선택</h3>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => setFontPickerOpen(false)}
                style={{
                  fontSize: '14px'
                }}
              >
                닫기
              </button>
            </div>
            <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--linear-secondary-400)' }}>
              파일명(확장자 제외)을 해당 폰트로 표시합니다. 클릭하면 적용됩니다.
            </div>
            <div
              role="listbox"
              aria-label="폰트 목록"
              style={{
                marginTop: '12px',
                maxHeight: '60vh',
                overflowY: 'auto',
                border: '1px solid var(--linear-neutral-500)',
                borderRadius: 'var(--linear-radius-sm)'
              }}
            >
              {fonts.map((font) => (
                <button
                  key={font.name}
                  role="option"
                  aria-selected={font.name === displayedFontFamily}
                  className="linear-button linear-button--secondary"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--linear-neutral-500)',
                    fontSize: '14px',
                    background: font.name === displayedFontFamily ? 'var(--linear-overlay-light)' : 'transparent'
                  }}
                  onClick={() => {
                    handleFontFamilyChange(font.name);
                    setFontPickerOpen(false);
                  }}
                  title={`${font.displayName}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: font.name,
                        fontSize: '16px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1
                      }}
                    >
                      {fontPreviewText}
                    </span>
                    <span
                      style={{
                        color: 'var(--linear-secondary-400)',
                        fontSize: '12px',
                        fontFamily: 'var(--linear-font-family)',
                        marginLeft: '8px'
                      }}
                    >
                      {font.displayName}
                    </span>
                  </div>
                </button>
              ))}
              {fonts.length === 0 && (
                <div style={{ padding: '12px', color: 'var(--linear-secondary-400)', fontSize: '14px' }}>
                  사용할 수 있는 폰트가 없습니다. public/font 폴더에 .ttf를 추가해 주세요.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 세 번째 카드: 내보내기 */}
      <aside className="linear-card">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="linear-button linear-button--primary"
            onClick={onExport}
            onTouchStart={() => {/* 모바일에서 터치 제스처 인식 보조 */}}
            style={{
              fontSize: '14px',
              height: '48px',
              border: '1px solid var(--linear-neutral-500)',
              width: '100%'
            }}
          >
            내보내기
          </button>
        </div>
      </aside>
    </div>
  );
};

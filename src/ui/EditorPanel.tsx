import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFonts } from "../hooks/useFonts";
import type { FrameType } from "../types/frame";
import { STICKER_CATEGORIES } from "./stickerCatalog";
import { getDefaultTextPosition } from "./defaultTextPosition";

type TextAlign = "left" | "center" | "right";

const LETTERING_SUGGESTIONS = Array.from(
  new Set([
    "다비야, 너의 1000일을 축하해 :)",
    "평생 함께 해♥",
    "내 세상은 네가 있어 더 아름다워",
    "우리집 둘 째",
    "우리 곧, 결혼해요.",
    "우리 셋의 세 번째 크리스마스",
    "곧, 만나",
    "널 위해 준비 했어",
    "너는 우리 행복 ♥",
    "2026년 첫 가족사진",
    "건강하게 만나자",
    "*우리의 평생을 약속 한 날*",
    "우리, 곧 결혼해요",
    "너를 기다리며",
    "2024.09.27",
    "세 번째 생일을 축하해",
    "손꼽아 기다린 여름날",
    "쑥쑥이와 엄마랑 아빠랑",
    "띠용아, 반가워 :)",
    "찰떡아, 곧 만나자 하트",
    "반짝이는 2026",
    "태어난지 1,000일",
    "오늘, 너의 100일",
    "이하늬, 두 돌",
    "시후, 네 번째 생일",
    "2022.04.21",
    "세로로",
    "연두야, 500일 축하해",
    "2024.05.21",
    "승아의 두 번째 여름",
    "다섯번 째, 결혼기념일",
    "행복한 또이네 하트",
    "너를 만나기 한달 전",
    "우리가족, 사랑해",
    "세상의 모든 사랑을 담아",
    "25년, 우리의 두 번째 여름",
    "1+1=3 하트",
    "평생 함께해*♥*",
    "우리집 귀염둥이",
    "우리집 사랑둥이들",
    "언제나 함께해",
  ])
);

export type EditorPanelProps = {
  selectedFrame?: FrameType | null;
  selectedText?: {
    id: string;
    text: string;
    x: number;
    y: number;
    boxWidth: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isBold: boolean;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: TextAlign;
    rotation: number;
  };
  selectedSticker?: {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    tintColor: string | null;
  };
  onTextInsert?: (textData: {
    text: string;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isBold: boolean;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: TextAlign;
    x: number;
    y: number;
  }) => void;
  onTextUpdate?: (textId: string, updates: Partial<{
    text: string;
    x: number;
    y: number;
    boxWidth: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isBold: boolean;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: TextAlign;
    rotation: number;
  }>) => void;
  onTextDelete?: (textId: string) => void;
  onStickerInsert?: (src: string) => void;
  onStickerUpdate?: (stickerId: string, updates: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    tintColor: string | null;
  }>) => void;
  onStickerDelete?: (stickerId: string) => void;
  onExport?: () => void;
  forcedTab?: "text" | "sticker" | null;
  showActionRail?: boolean;
  showExportButton?: boolean;
};

export const EditorPanel: React.FC<EditorPanelProps> = ({
  selectedFrame,
  selectedText,
  selectedSticker,
  onTextInsert,
  onTextUpdate,
  onTextDelete,
  onStickerInsert,
  onStickerDelete,
  onExport,
  forcedTab,
  showActionRail = true,
  showExportButton = true,
}) => {
  const [activeTab, setActiveTab] = useState<"text" | "sticker" | null>(forcedTab ?? null);
  const [selectedStickerCategory, setSelectedStickerCategory] = useState<string | null>(null);
  const [categoryPreviewIndexes, setCategoryPreviewIndexes] = useState<Record<string, number>>({});
  const [loadedCategoryPreviews, setLoadedCategoryPreviews] = useState<Record<string, boolean>>({});
  const [stickerPreviewIndexes, setStickerPreviewIndexes] = useState<Record<string, number>>({});
  const [loadedStickerPreviews, setLoadedStickerPreviews] = useState<Record<string, boolean>>({});

  // Text State
  const [textInput, setTextInput] = useState("");
  const [textSize, setTextSize] = useState(16);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [fontFamily, setFontFamily] = useState("");
  const [isFontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontColor, setFontColor] = useState("#000000");
  const [textAlign, setTextAlign] = useState<TextAlign>("center");
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
      setActiveTab("text");
    }
  }, [selectedText]);

  useEffect(() => {
    if (selectedSticker) {
      setActiveTab("sticker");
    }
  }, [selectedSticker]);

  useEffect(() => {
    if (forcedTab !== undefined) {
      setActiveTab(forcedTab);
    }
  }, [forcedTab]);

  // 고정 미리보기 문구
  const fontPreviewText = '내 세상은 네가 있어 더 아름다워♥, 2025.09.13';

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
  const displayedIsBold = selectedText?.isBold ?? isBold;
  const displayedIsItalic = selectedText?.isItalic ?? isItalic;
  const displayedIsVertical = selectedText?.isVertical ?? isVertical;
  const displayedTextAlign = selectedText?.textAlign ?? textAlign;

  const handleStickerPreviewError = (slotKey: string, candidateCount: number) => {
    setStickerPreviewIndexes((prev) => {
      const currentIndex = prev[slotKey] ?? 0;

      if (currentIndex >= candidateCount) {
        return prev;
      }

      return {
        ...prev,
        [slotKey]: currentIndex + 1,
      };
    });
    setLoadedStickerPreviews((prev) => ({
      ...prev,
      [slotKey]: false,
    }));
  };

  const handleCategoryPreviewError = (categoryId: string, candidateCount: number) => {
    setCategoryPreviewIndexes((prev) => {
      const currentIndex = prev[categoryId] ?? 0;

      if (currentIndex >= candidateCount) {
        return prev;
      }

      return {
        ...prev,
        [categoryId]: currentIndex + 1,
      };
    });
    setLoadedCategoryPreviews((prev) => ({
      ...prev,
      [categoryId]: false,
    }));
  };

  const handleCategoryPreviewLoad = (categoryId: string) => {
    setLoadedCategoryPreviews((prev) => ({
      ...prev,
      [categoryId]: true,
    }));
  };

  const handleStickerPreviewLoad = (slotKey: string) => {
    setLoadedStickerPreviews((prev) => ({
      ...prev,
      [slotKey]: true,
    }));
  };

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
      isBold,
      isItalic,
      isVertical,
      textAlign: displayedTextAlign,
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

  const handleBoldToggle = () => {
    const newIsBold = !displayedIsBold;
    setIsBold(newIsBold);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { isBold: newIsBold });
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

  const handleTextAlignChange = (newAlign: TextAlign) => {
    setTextAlign(newAlign);
    if (selectedText && onTextUpdate) {
      onTextUpdate(selectedText.id, { textAlign: newAlign });
    }
  };

  const stickerScrollAreaStyle: React.CSSProperties = {
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
    marginTop: '12px',
    paddingRight: 'var(--linear-space-3)',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: showActionRail ? 'row-reverse' : 'column',
      height: '100%',
      minHeight: 0,
      gap: '16px',
    }}>
      {/* 탭 네비게이션 (아이콘 바) */}
      {showActionRail && (
        <aside
          className="linear-card"
          style={{
            width: '56px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 8px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setActiveTab(activeTab === 'text' ? null : 'text')}
            style={{
              background: activeTab === 'text' ? 'var(--linear-neutral-50)' : 'transparent',
              color: activeTab === 'text' ? 'var(--linear-neutral-600)' : 'var(--linear-secondary-300)',
              border: 'none',
              boxShadow: 'none',
              width: '100%',
              padding: '12px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>글씨</span>
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'sticker' ? null : 'sticker')}
            style={{
              background: activeTab === 'sticker' ? 'var(--linear-neutral-50)' : 'transparent',
              color: activeTab === 'sticker' ? 'var(--linear-neutral-600)' : 'var(--linear-secondary-300)',
              border: 'none',
              boxShadow: 'none',
              width: '100%',
              padding: '12px 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>스티커</span>
          </button>

          <div style={{ flex: 1 }} />

          {showExportButton && (
            <button
              className="linear-button linear-button--primary"
              onClick={onExport}
              onTouchStart={() => {/* 모바일 보조 */ }}
              style={{ width: '100%', height: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: 0 }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>저장</span>
            </button>
          )}
        </aside>
      )}

      {/* 펼쳐지는 편집 패널 */}
      {activeTab && (
        <aside
          className="linear-card linear-fade-in"
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--linear-space-2)',
            minHeight: 0,
            overflow: 'hidden',
            paddingRight: 0,
          }}
        >

          {activeTab === 'text' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--linear-space-2)',
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                minHeight: 0,
                paddingBottom: '16px',
                paddingRight: 'var(--linear-space-3)',
              }}
            >
              {/* 텍스트 내용 작성 파트 */}
              <div>
                <h3>사진에 글씨 새기기</h3>
                <div className="linear-grid linear-mt-4" style={{ gridTemplateColumns: "1fr" }}>
                  <label>
                    <p style={{ fontSize: "var(--linear-text-sm)" }}>텍스트를 입력하세요.</p>
                    <textarea
                      ref={textInputRef as React.RefObject<HTMLTextAreaElement>}
                      className="linear-input"
                      style={{
                        width: '100%', borderColor: 'var(--linear-neutral-300)',
                        minHeight: '100px', resize: 'vertical', marginTop: 'var(--linear-space-1)'
                      }}
                      placeholder="예) 너의 100일을 축하해 :)"
                      value={textInput}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setTextInput(newValue);
                        if (selectedText && onTextUpdate) {
                          onTextUpdate(selectedText.id, { text: newValue });
                        }
                      }}
                    />
                  </label>

                  <label>
                    <p style={{ fontSize: "var(--linear-text-sm)" }}>레터링을 추천해 드릴게요 :)</p>
                    <select
                      className="linear-select"
                      style={{ width: '100%', textOverflow: 'ellipsis', borderColor: 'var(--linear-neutral-300)', marginTop: 'var(--linear-space-1)' }}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleDescriptionSelect(e.target.value);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>클릭해서 추천받기</option>
                      {LETTERING_SUGGESTIONS.map((suggestion) => (
                        <option key={suggestion} value={suggestion}>
                          {suggestion}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="linear-flex linear-mt-4" style={{ gap: '6px' }}>
                    <button
                      className="linear-button linear-button--secondary"
                      onClick={handleTextDelete}
                      disabled={!selectedText}
                      style={{
                        opacity: selectedText ? 1 : 0.5, cursor: selectedText ? 'pointer' : 'not-allowed',
                        fontSize: '14px', height: '48px', border: 'var(--border-width) solid var(--linear-neutral-500)', flex: 1
                      }}
                    >
                      삭제
                    </button>
                    <button
                      className="linear-button linear-button--primary"
                      onClick={handleTextInsert}
                      style={{
                        fontSize: '14px', height: '48px', border: 'var(--border-width) solid var(--linear-neutral-500)', flex: 1
                      }}
                    >
                      삽입
                    </button>
                  </div>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: 'var(--border-width) solid var(--linear-neutral-500)', margin: 'var(--linear-space-2) 0' }} />

              {/* 텍스트 스타일 설정 파트 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--linear-space-3)" }}>
                {/* 폰트 선택 (전체 너비) */}
                <label>
                  <p style={{ fontSize: "var(--linear-text-sm)", marginBottom: "var(--linear-space-1)" }}>폰트 선택</p>
                  <div className="linear-flex" style={{ alignItems: 'center' }}>
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => !fontsLoading && setFontPickerOpen(true)}
                      disabled={fontsLoading}
                      title={fontsLoading ? '폰트 로딩 중' : '폰트 선택'}
                      style={{
                        border: 'var(--border-width) solid var(--linear-neutral-500)',
                        padding: '6px 10px', fontSize: '14px', fontFamily: displayedFontFamily || 'var(--linear-font-family)',
                        width: '100%',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}
                    >
                      {fontsLoading ? '로딩 중…' : (displayedFontFamily || '선택')}
                    </button>
                  </div>
                </label>

                {/* 크기 및 색상 (1fr 1fr) */}
                <div className="linear-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--linear-space-2)" }}>
                  <label>
                    <p style={{ fontSize: "var(--linear-text-sm)", marginBottom: "var(--linear-space-1)" }}>폰트 크기</p>
                    <input
                      type="number"
                      className="linear-input"
                      style={{ borderColor: 'var(--linear-neutral-300)', width: '100%' }}
                      value={displayedTextSize}
                      onChange={(e) => handleTextSizeChange(Number(e.target.value))}
                      min="1" max="99" placeholder="16"
                    />
                  </label>

                  <label>
                    <p style={{ fontSize: "var(--linear-text-sm)", marginBottom: "var(--linear-space-1)" }}>폰트 색상</p>
                    <input
                      type="color"
                      className="linear-input"
                      style={{ borderColor: 'var(--linear-neutral-300)', width: '100%', height: '36px', padding: '2px' }}
                      value={displayedFontColor}
                      onChange={(e) => handleFontColorChange(e.target.value)}
                    />
                  </label>
                </div>

                {/* 폰트 스타일 */}
                <div>
                  <p style={{ fontSize: "var(--linear-text-sm)", marginBottom: "var(--linear-space-1)" }}>폰트 스타일</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`linear-button ${displayedIsBold ? 'linear-button--primary' : 'linear-button--secondary'}`}
                      onClick={handleBoldToggle}
                      style={{ flex: 1, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', whiteSpace: 'nowrap', minWidth: 0, padding: '0 4px' }}
                    >
                      굵게
                    </button>
                    <button
                      type="button"
                      className={`linear-button ${displayedIsItalic ? 'linear-button--primary' : 'linear-button--secondary'}`}
                      onClick={handleItalicToggle}
                      style={{ flex: 1, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', whiteSpace: 'nowrap', minWidth: 0, padding: '0 4px' }}
                    >
                      기울임
                    </button>
                    <button
                      type="button"
                      className={`linear-button ${displayedIsVertical ? 'linear-button--primary' : 'linear-button--secondary'}`}
                      onClick={handleVerticalToggle}
                      style={{ flex: 1, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', whiteSpace: 'nowrap', minWidth: 0, padding: '0 4px' }}
                    >
                      세로쓰기
                    </button>
                  </div>
                </div>

                {/* 텍스트 정렬 */}
                <div>
                  <p style={{ fontSize: "var(--linear-text-sm)", marginBottom: "var(--linear-space-1)" }}>텍스트 정렬</p>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["left", "center", "right"].map((align) => (
                      <button
                        key={align}
                        type="button"
                        className={`linear-button ${displayedTextAlign === align ? "linear-button--primary" : "linear-button--secondary"}`}
                        onClick={() => handleTextAlignChange(align as TextAlign)}
                        disabled={!selectedText}
                        style={{
                          flex: 1, height: "36px", border: "var(--border-width) solid var(--linear-neutral-500)",
                          opacity: selectedText ? 1 : 0.5, cursor: selectedText ? "pointer" : "not-allowed",
                          display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          {align === 'left' && (
                            <>
                              <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" />
                              <line x1="4" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="2" />
                              <line x1="4" y1="18" x2="18" y2="18" stroke="currentColor" strokeWidth="2" />
                            </>
                          )}
                          {align === 'center' && (
                            <>
                              <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" />
                              <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" />
                              <line x1="5" y1="18" x2="19" y2="18" stroke="currentColor" strokeWidth="2" />
                            </>
                          )}
                          {align === 'right' && (
                            <>
                              <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" />
                              <line x1="10" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" />
                              <line x1="6" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" />
                            </>
                          )}
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sticker' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--linear-space-2)', flex: 1, minHeight: 0 }}>
              {!selectedStickerCategory ? (
                <>
                  <h3>스티커 선택</h3>
                  <p style={{ fontSize: 'var(--linear-text-sm)', color: 'var(--linear-secondary-400)' }}>
                    클릭하여 스티커 목록을 확인하세요.
                  </p>
                  <div
                    style={{
                      ...stickerScrollAreaStyle,
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "12px",
                      alignContent: "start",
                    }}
                  >
                    {STICKER_CATEGORIES.map((category) => {
                      const currentIndex = categoryPreviewIndexes[category.id] ?? 0;
                      const previewSrc = category.previewCandidates[currentIndex];
                      const isReady = currentIndex < category.previewCandidates.length && Boolean(previewSrc);

                      return (
                        <div
                          key={category.id}
                          className="frame-gallery-card"
                          onClick={() => setSelectedStickerCategory(category.id)}
                          style={{
                            borderColor: 'var(--linear-neutral-400)',
                          }}
                        >
                          <div className={`frame-gallery-image-container ${loadedCategoryPreviews[category.id] ? 'loaded' : 'loading'}`} style={{
                            aspectRatio: '1',
                            borderBottomColor: 'var(--linear-neutral-400)'
                          }}>
                            {isReady ? (
                              <img
                                src={previewSrc}
                                alt={category.label}
                                loading="lazy"
                                onLoad={() => handleCategoryPreviewLoad(category.id)}
                                onError={() => handleCategoryPreviewError(category.id, category.previewCandidates.length)}
                              />
                            ) : null}
                          </div>
                          <div className="frame-gallery-label" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="label-text" style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--linear-neutral-50)' }}>
                              {category.label}
                            </span>
                            <span className="label-desc" style={{ fontSize: '12px', color: 'var(--linear-secondary-300)' }}>
                              {category.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      className="linear-button linear-button--primary"
                      onClick={() => setSelectedStickerCategory(null)}
                      style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        border: 'var(--border-width) solid var(--linear-neutral-500)'
                      }}
                    >
                      ← 뒤로
                    </button>
                    <h3 style={{ margin: 0, fontSize: '16px', flex: 1, color: 'var(--linear-neutral-50)' }}>
                      {STICKER_CATEGORIES.find(c => c.id === selectedStickerCategory)?.label}
                    </h3>
                  </div>
                  <div
                    style={{
                      ...stickerScrollAreaStyle,
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "8px",
                      alignContent: "start",
                    }}
                  >
                    {STICKER_CATEGORIES.find(c => c.id === selectedStickerCategory)?.stickers.map((slot) => {
                      const currentIndex = stickerPreviewIndexes[slot.key] ?? 0;
                      const previewSrc = slot.candidates[currentIndex];
                      const isReady = currentIndex < slot.candidates.length && Boolean(previewSrc);
                      const isInsertable = isReady && loadedStickerPreviews[slot.key] === true;

                      return (
                        <button
                          key={slot.key}
                          onClick={() => {
                            if (isInsertable && previewSrc && onStickerInsert) {
                              onStickerInsert(previewSrc);
                            }
                          }}
                          disabled={!isInsertable}
                          style={{
                            aspectRatio: '1',
                            border: 'none',
                            background: 'transparent',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isInsertable ? 'pointer' : 'not-allowed',
                            padding: '0',
                            opacity: isInsertable ? 1 : 0.5,
                          }}
                        >
                          {!isReady ? null : (
                            <img
                              src={previewSrc}
                              alt={`${slot.key} sticker`}
                              loading="lazy"
                              onLoad={() => handleStickerPreviewLoad(slot.key)}
                              onError={() => handleStickerPreviewError(slot.key, slot.candidates.length)}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="linear-mt-4">
                <button
                  className="linear-button linear-button--secondary"
                  onClick={() => {
                    if (selectedSticker && onStickerDelete) {
                      onStickerDelete(selectedSticker.id);
                    } else if (!selectedSticker) {
                      alert("삭제할 스티커를 선택해주세요.");
                    }
                  }}
                  disabled={!selectedSticker}
                  style={{
                    width: '100%',
                    opacity: selectedSticker ? 1 : 0.5,
                    borderColor: selectedSticker ? 'var(--linear-accent-error)' : 'var(--linear-neutral-500)',
                    color: selectedSticker ? 'var(--linear-accent-error)' : 'inherit'
                  }}
                >
                  선택한 스티커 삭제
                </button>
              </div>
            </div>
          )}

          {/* 폰트 선택 모달 */}
          {isFontPickerOpen && typeof document !== 'undefined' && createPortal(
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
                zIndex: 9999
              }}
              onClick={() => setFontPickerOpen(false)}
            >
              <div
                className="linear-card"
                style={{
                  width: 'min(800px, 90vw)',
                  height: '80vh',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-lg)',
                  borderRadius: '0',
                  border: 'var(--border-width) solid var(--linear-neutral-500)'
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
                    flex: 1,
                    overflowY: 'auto',
                    border: 'var(--border-width) solid var(--linear-neutral-500)',
                    borderRadius: '0'
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
                        borderBottom: 'var(--border-width) solid var(--linear-neutral-500)',
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
            </div>,
            document.body
          )}
        </aside>
      )}
    </div>
  );
};

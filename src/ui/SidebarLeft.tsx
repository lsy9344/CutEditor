import React, { useState } from "react";
import { FRAME_LAYOUTS, type FrameType, type FrameOption } from "../types/frame";
import { getCategorySelectionOutcome } from "../utils/frameChangeFlow";

export type SidebarLeftProps = {
  selectedFrame: FrameType | null;
  onFrameSelect: (frame: FrameType | null) => void;
  frameColor?: string;
  onFrameColorChange?: (color: string) => void;
  canvasMode: 'gallery' | 'editor';
  onCanvasModeChange: (mode: 'gallery' | 'editor') => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
};

export const FRAME_OPTIONS_BY_CATEGORY: Record<string, FrameOption[]> = {
  "1컷": [
    { value: "1l", label: "사진에 글씨새기기", image: "1l.png", orientation: "vertical", description: "사진에 직접 텍스트 올리기" },
    { value: "1f", label: "1컷 프레임", image: "1f.png", orientation: "vertical", description: "프레임 안에 사진 넣기" },
  ],
  "2컷": [
    { value: "2h", label: "2컷 가로", image: "2h.png", orientation: "horizontal" },
    { value: "2v", label: "2컷 세로", image: "2v.png", orientation: "vertical" },
  ],
  "3컷": [
    { value: "3v_1", label: "3컷 세로 1", image: "3v_1.png", orientation: "vertical" },
  ],
  "4컷": [
    { value: "4v_1", label: "4컷 세로 1", image: "4v_1.png", orientation: "vertical" },
    { value: "4v_2", label: "4컷 세로 2", image: "4v_2.png", orientation: "vertical" },
    { value: "4v_3", label: "4컷 세로 3", image: "4v_3.png", orientation: "vertical" },
    { value: "4v_4", label: "4컷 세로 4", image: "4v_4.png", orientation: "vertical" },
    { value: "4v_5", label: "4컷 세로 5", image: "4v_5.png", orientation: "vertical" },
    { value: "4v_6", label: "4컷 세로 6", image: "4v_6.png", orientation: "vertical" },
  ],
  "6컷": [
    { value: "6v_1", label: "6컷 세로 1", image: "6v_1.png", orientation: "vertical" },
    { value: "6v_2", label: "6컷 세로 2", image: "6v_2.png", orientation: "vertical" },
  ],
  "8컷": [
    { value: "8v_1", label: "8컷 세로 1", image: "8v_1.png", orientation: "vertical" },
    { value: "8v_2", label: "8컷 세로 2", image: "8v_2.png", orientation: "vertical" },
  ],
  "9컷": [
    { value: "9v", label: "9컷 세로", image: "9v.png", orientation: "vertical" },
  ]
};

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  selectedFrame,
  onFrameSelect,
  canvasMode,
  onCanvasModeChange,
  selectedCategory,
  onCategoryChange,
}) => {
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [previewSources, setPreviewSources] = useState<Record<string, string>>({});

  const handleImageLoad = (value: string) => {
    setLoadedImages((prev) => ({ ...prev, [value]: true }));
  };

  const getPreviewSource = (option: FrameOption): string => {
    return previewSources[option.value] ?? `/popover/${option.image}`;
  };

  const handleImageError = (option: FrameOption) => {
    const fallbackSource = FRAME_LAYOUTS[option.value]?.imagePath;
    if (!fallbackSource) return;

    setPreviewSources((prev) => {
      if (prev[option.value] === fallbackSource) {
        return prev;
      }
      return { ...prev, [option.value]: fallbackSource };
    });
    setLoadedImages((prev) => ({ ...prev, [option.value]: false }));
  };

  const handleCategoryClick = (category: string) => {
    const options = FRAME_OPTIONS_BY_CATEGORY[category] ?? [];
    const outcome = getCategorySelectionOutcome({
      selectedCategory,
      category,
      options: options.map((option) => option.value),
    });

    onCategoryChange(outcome.nextCategory);
    onCanvasModeChange(outcome.nextCanvasMode);

    if (outcome.autoSelectFrame) {
      onFrameSelect(outcome.autoSelectFrame);
    }
  };

  const handleFrameSelect = (frame: FrameType) => {
    onFrameSelect(frame);
  };

  const activeCategory = selectedCategory || Object.keys(FRAME_OPTIONS_BY_CATEGORY).find(cat =>
    FRAME_OPTIONS_BY_CATEGORY[cat].some(opt => opt.value === selectedFrame)
  ) || null;

  return (
    <aside className="linear-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, textAlign: "center" }}>
        <h2 style={{ margin: "0", fontSize: "var(--linear-text-lg)", fontWeight: "var(--linear-font-medium)" }}>
          다비스튜디오 컷편집기
        </h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "var(--linear-text-sm)", color: "var(--linear-secondary-400)" }}>
          2/4/6/9컷 편집, 레터링
        </p>
      </div>

      <hr style={{ flexShrink: 0, border: 'none', borderTop: 'var(--border-width) solid var(--linear-neutral-500)', margin: '0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <h3 style={{ flexShrink: 0, marginBottom: "12px" }}>프레임 컷 수 선택</h3>
        <div style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
          {Object.keys(FRAME_OPTIONS_BY_CATEGORY).map((category) => (
            <button
              key={category}
              className={`linear-button ${activeCategory === category ? "linear-button--primary" : "linear-button--secondary"}`}
              onClick={() => handleCategoryClick(category)}
              style={{
                width: "100%",
                height: "48px",
                padding: "0",
                fontSize: "15px",
                border: activeCategory === category
                  ? "var(--border-width) solid var(--linear-neutral-500)"
                  : "var(--border-width) solid var(--linear-neutral-500)",
                backgroundColor: activeCategory === category
                  ? "var(--linear-primary-500)"
                  : "var(--linear-neutral-600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {category.replace('컷', '')}컷
            </button>
          ))}
        </div>

        {activeCategory && (
          <div className="linear-fade-in" style={{ backgroundColor: "var(--linear-neutral-600)", borderRadius: "var(--radius-base)", border: "var(--border-width) solid var(--linear-neutral-500)", padding: "16px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <p style={{ flexShrink: 0, marginBottom: "12px", color: "var(--linear-secondary-400)", fontSize: "var(--linear-text-sm)", textAlign: "center" }}>
              {activeCategory} 상세 스타일을 선택하세요.
            </p>

            <div style={{ flexShrink: 0, marginBottom: '16px' }}>
              <button
                className="linear-button linear-button--secondary"
                onClick={() => onCanvasModeChange('gallery')}
                style={{ width: "100%" }}
              >
                ← 다른 프레임 갤러리 보기
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", overflowY: "auto", flex: 1, minHeight: 0, alignContent: "start", paddingRight: "12px", marginRight: "-4px" }}>
              {FRAME_OPTIONS_BY_CATEGORY[activeCategory].map((option) => (
                <div
                  key={option.value}
                  className={`frame-gallery-card ${option.orientation === 'horizontal' ? 'span-2' : ''}`}
                  onClick={() => handleFrameSelect(option.value)}
                  style={{
                    backgroundColor: selectedFrame === option.value ? 'var(--linear-primary-500)' : 'var(--linear-neutral-600)',
                    boxShadow: selectedFrame === option.value ? 'var(--shadow-lg)' : 'var(--shadow-base)',
                    transform: selectedFrame === option.value ? 'translate(-4px, -4px)' : 'none',
                    zIndex: selectedFrame === option.value ? 2 : 1,
                    position: 'relative'
                  }}
                >
                  <div className={`frame-gallery-image-container ${loadedImages[option.value] ? 'loaded' : 'loading'}`}>
                    <img
                      src={getPreviewSource(option)}
                      alt={option.label}
                      loading="lazy"
                      onLoad={() => handleImageLoad(option.value)}
                      onError={() => handleImageError(option)}
                    />
                    {canvasMode === 'editor' && selectedFrame === option.value && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        backgroundColor: 'var(--linear-accent-success-bg)',
                        color: 'var(--linear-neutral-50)',
                        border: '2px solid var(--linear-neutral-500)',
                        boxShadow: '2px 2px 0px 0px #000',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '900',
                        fontSize: '16px',
                        zIndex: 10
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                  <div className="frame-gallery-label" style={{ padding: '8px' }}>
                    <span className="label-text" style={{ 
                      fontSize: '12px', 
                      color: 'var(--linear-neutral-50)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '4px'
                    }}>
                      {option.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

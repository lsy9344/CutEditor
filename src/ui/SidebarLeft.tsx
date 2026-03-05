import React, { useRef, useState } from "react";
import type { FrameType, FrameOption } from "../types/frame";

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
    { value: "1l", label: "사진에 글씨새기기", image: "1_l.png", orientation: "vertical", description: "사진에 직접 텍스트 올리기" },
    { value: "1f", label: "1컷 프레임", image: "1_v.png", orientation: "vertical", description: "프레임 안에 사진 넣기" },
  ],
  "2컷": [
    { value: "2h", label: "2컷 가로", image: "2_h.png", orientation: "horizontal" },
    { value: "2v", label: "2컷 세로", image: "2_v.png", orientation: "vertical" },
  ],
  "4컷": [
    { value: "4v", label: "4컷 세로", image: "4_v.png", orientation: "vertical" },
  ],
  "6컷": [
    { value: "6v", label: "6컷 세로", image: "6_v.png", orientation: "vertical" },
  ],
  "9컷": [
    { value: "9v", label: "9컷 세로", image: "9_v.png", orientation: "vertical" },
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
  const isMobile = (() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || (navigator as any).maxTouchPoints > 0;
  })();

  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category) {
      onCategoryChange(null);
      onCanvasModeChange('gallery');
    } else {
      onCategoryChange(category);
      onCanvasModeChange('gallery');
      const options = FRAME_OPTIONS_BY_CATEGORY[category];
      if (options && options.length === 1) {
        onFrameSelect(options[0].value);
        onCanvasModeChange('editor');
      }
    }
  };

  const handleFrameSelect = (frame: FrameType) => {
    onFrameSelect(frame);
  };

  const activeCategory = selectedCategory || Object.keys(FRAME_OPTIONS_BY_CATEGORY).find(cat =>
    FRAME_OPTIONS_BY_CATEGORY[cat].some(opt => opt.value === selectedFrame)
  ) || null;

  return (
    <aside className="linear-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ margin: "0", fontSize: "var(--linear-text-lg)", fontWeight: "var(--linear-font-medium)" }}>
          다비스튜디오 컷편집기
        </h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "var(--linear-text-sm)", color: "var(--linear-secondary-400)" }}>
          2/4/6/9컷 편집, 레터링
        </p>
      </div>

      <hr style={{ border: 'none', borderTop: 'var(--border-width) solid var(--linear-neutral-500)', margin: '0' }} />

      <div>
        <h3 style={{ marginBottom: "12px" }}>프레임 컷 수 선택</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginBottom: "16px" }}>
          {Object.keys(FRAME_OPTIONS_BY_CATEGORY).map((category) => (
            <button
              key={category}
              className={`linear-button ${activeCategory === category ? "linear-button--primary" : "linear-button--secondary"}`}
              onClick={() => handleCategoryClick(category)}
              style={{
                width: "100%",
                height: "40px",
                padding: "0",
                fontSize: "13px",
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
          <div className="linear-fade-in" style={{ backgroundColor: "var(--linear-neutral-600)", borderRadius: "var(--radius-base)", border: "var(--border-width) solid var(--linear-neutral-500)", padding: "16px" }}>
            <p style={{ marginBottom: "12px", color: "var(--linear-secondary-400)", fontSize: "var(--linear-text-sm)", textAlign: "center" }}>
              {activeCategory} 상세 스타일을 선택하세요.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
              {FRAME_OPTIONS_BY_CATEGORY[activeCategory].map((option) => (
                <div key={option.value} style={{ position: "relative" }}>
                  <button
                    className={`linear-button ${selectedFrame === option.value
                      ? "linear-button--primary"
                      : "linear-button--secondary"
                      }`}
                    onClick={() => handleFrameSelect(option.value)}
                    style={{
                      width: "100%",
                      height: "48px",
                      border: selectedFrame === option.value
                        ? "var(--border-width) solid var(--linear-neutral-500)"
                        : "var(--border-width) solid var(--linear-neutral-400)",
                      backgroundColor: selectedFrame === option.value
                        ? "var(--linear-primary-500)"
                        : "var(--linear-neutral-700)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 16px",
                      fontSize: "14px",
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {option.label}
                      {canvasMode === 'editor' && selectedFrame === option.value && (
                        <span style={{
                          backgroundColor: 'var(--linear-neutral-900)',
                          color: 'var(--linear-primary-500)',
                          fontSize: '11px',
                          padding: '2px 6px',
                          border: '1px solid var(--linear-primary-500)'
                        }}>
                          ✏️ 편집 중
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '16px', opacity: 0.7 }}>
                      {option.orientation === 'horizontal' ? '↔️' : '↕️'}
                    </span>
                  </button>
                  {option.description && (
                    <div style={{ fontSize: '12px', color: 'var(--linear-secondary-400)', marginTop: '4px', textAlign: 'center' }}>
                      {option.description}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                className="linear-button linear-button--secondary"
                onClick={() => onCanvasModeChange('gallery')}
                style={{ width: "100%" }}
              >
                ← 다른 프레임 갤러리 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

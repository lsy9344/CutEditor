import React, { useState } from "react";
import type { FrameType } from "../types/frame";

export type SidebarLeftProps = {
  selectedFrame: FrameType | null;
  onFrameSelect: (frame: FrameType | null) => void;
  frameColor: string;
  onFrameColorChange: (color: string) => void;
};

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  selectedFrame,
  onFrameSelect,
  frameColor,
  onFrameColorChange,
}) => {
  const [hoveredFrame, setHoveredFrame] = useState<FrameType | null>(null);

  const handleFrameSelect = (frame: FrameType) => {
    onFrameSelect(frame);
  };

  const handleMouseEnter = (frame: FrameType) => {
    setHoveredFrame(frame);
  };

  const handleMouseLeave = () => {
    setHoveredFrame(null);
  };

  const frameOptions: Array<{value: FrameType, label: string, image: string}> = [
    { value: "2", label: "2컷 가로", image: "2v.png" },
    { value: "2v", label: "2컷 세로", image: "2v.png" },
    { value: "4", label: "4컷", image: "9.png" },
    { value: "6", label: "6컷", image: "2v.png" },
    { value: "9", label: "9컷", image: "9.png" },
  ];

  return (
    <aside className="linear-card">
      <h3>프레임 선택</h3>
      <div className="linear-mt-4 linear-grid" style={{ gridTemplateColumns: "1fr" }}>
        <p style={{ marginBottom: "16px", color: "var(--linear-secondary-400)" }}>
          아래 버튼을 클릭하여 프레임을 선택하세요.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
          {frameOptions.map((option) => (
            <div key={option.value} style={{ position: "relative" }}>
              <button
                className={`linear-button ${
                  selectedFrame === option.value
                    ? "linear-button--primary"
                    : "linear-button--secondary"
                }`}
                onClick={() => handleFrameSelect(option.value)}
                onMouseEnter={() => handleMouseEnter(option.value)}
                onMouseLeave={handleMouseLeave}
                style={{
                  width: "100%",
                  height: "48px",
                  aspectRatio: "1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {option.label}
              </button>
              {hoveredFrame === option.value && (
                <div
                  style={{
                    position: "absolute",
                    left: "calc(100% + 12px)",
                    top: "50%",
                    transform: "translateY(-50%)",
                    backgroundColor: "var(--linear-neutral-600)",
                    border: "1px solid var(--linear-neutral-500)",
                    borderRadius: "var(--linear-radius-sm)",
                    padding: "8px",
                    zIndex: 1000,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                    pointerEvents: "none",
                  }}
                >
                  <img
                    src={`/popover/${option.image}`}
                    alt={`${option.label} 프레임 미리보기`}
                    style={{
                      width: "240px",
                      height: "auto",
                      display: "block",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <hr className="linear-mt-6 linear-mb-6" style={{ border: 'none', borderTop: '1px solid var(--linear-neutral-500)' }} />
      
      <h3>프레임 색상 변경</h3>
      <div className="linear-mt-4">
        <label>
          <h4>프레임 색상</h4>
          <input 
            type="color"
            className="linear-input linear-mt-4"
            value={frameColor}
            onChange={(e) => onFrameColorChange(e.target.value)}
            style={{ width: '100%', height: '40px' }}
          />
        </label>
      </div>
    </aside>
  );
};

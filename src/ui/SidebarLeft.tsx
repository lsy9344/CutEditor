import React, { useState } from "react";
import type { FrameType } from "../types/frame";

export type SidebarLeftProps = {
  selectedFrame: FrameType | null;
  onFrameSelect: (frame: FrameType | null) => void;
  frameColor?: string;
  onFrameColorChange?: (color: string) => void;
};

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  selectedFrame,
  onFrameSelect,
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
    { value: "1l", label: "1컷 레터링", image: "1l.png" },
    { value: "1f", label: "1컷 프레임", image: "1f.png" },
    { value: "2h", label: "2컷 가로", image: "2h.png" },
    { value: "2v", label: "2컷 세로", image: "2v.png" },
    /*{ value: "4h", label: "4컷 가로", image: "4h.png" },*/
    { value: "4v", label: "4컷", image: "4v.png" },
    /*{ value: "6h", label: "6컷 가로", image: "6h.png" },*/
    { value: "6v", label: "6컷", image: "6v.png" },
    /*{ value: "9h", label: "9컷 가로", image: "9h.png" },*/
    { value: "9v", label: "9컷", image: "9v.png" },
  ];

  return (
    <aside className="linear-card">
      <div style={{ marginBottom: "24px", textAlign: "center" }}>
        <h2 style={{ margin: "0", fontSize: "var(--linear-text-lg)", fontWeight: "var(--linear-font-medium)" }}>
          다비스튜디오 컷편집기
        </h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "var(--linear-text-xs)", color: "var(--linear-secondary-400)" }}>
          2/4/6/9컷 편집, 레터링
        </p>
      </div>
      
      <hr style={{ border: 'none', borderTop: '1px solid var(--linear-neutral-500)', margin: '0 0 24px 0' }} />
      
      <h3>프레임 선택</h3>
      <div className="linear-mt-4 linear-grid" style={{ gridTemplateColumns: "1fr" }}>
        <p style={{ marginBottom: "2px", color: "var(--linear-secondary-400)", fontSize: "var(--linear-text-xs)" }}>
          아래 버튼을 클릭하여 프레임을 선택하세요.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                  border: selectedFrame === option.value
                    ? "1px solid var(--linear-primary-500)"
                    : "1px solid var(--linear-neutral-500)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
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
    </aside>
  );
};

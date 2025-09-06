import React, { useState } from "react";

export type SidebarLeftProps = {
  selectedFrame: string | null;
  onFrameSelect: (frame: string | null) => void;
};

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  selectedFrame,
  onFrameSelect,
}) => {
  const [hoveredFrame, setHoveredFrame] = useState<string | null>(null);

  const handleFrameSelect = (frame: string) => {
    onFrameSelect(frame);
  };

  const handleMouseEnter = (frame: string) => {
    setHoveredFrame(frame);
  };

  const handleMouseLeave = () => {
    setHoveredFrame(null);
  };

  const frameOptions = [
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
    </aside>
  );
};

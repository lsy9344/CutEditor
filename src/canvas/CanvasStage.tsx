// 캔버스 스테이지 컴포넌트 스켈레톤 (Konva/Fabric로 대체 예정)

import React from "react";
import type { Template } from "../state/types";

export type CanvasStageProps = {
  template: Template | null;
  selection: string | null;
  zoom: number;
  selectedFrame: string | null;
  onSelect?: (id: string | null) => void;
  onZoomChange?: (zoom: number) => void;
  onTransform?: (change: unknown) => void;
  onDropImage?: (file: File, slotId: string) => void;
};

export const CanvasStage: React.FC<CanvasStageProps> = ({ 
  template, 
  zoom, 
  selectedFrame,
  onZoomChange
}) => {
  // TODO: Konva/Fabric 렌더링 구현. 현재는 프리뷰용 placeholder.
  
  // 프레임이 선택되지 않았을 때 메시지 표시
  if (!selectedFrame) {
    return (
      <div className="linear-card linear-fade-in" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center'
      }}>
        <div>
          <h3 style={{ marginBottom: '16px' }}></h3>
          <p style={{ 
            color: 'var(--linear-secondary-400)', 
            fontSize: 'var(--linear-text-lg)',
            fontWeight: 'var(--linear-font-medium)'
          }}>
            왼쪽 메뉴에서 프레임을 먼저 선택해 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="linear-card linear-fade-in">
      <h3>Canvas</h3>
      <div className="linear-mt-4">
        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--linear-neutral-50)' }}>
          Zoom:
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            className="linear-input"
            value={Math.round(zoom * 100)}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value > 0 && onZoomChange) {
                onZoomChange(value / 100);
              }
            }}
            min="10"
            max="400"
            step="10"
            style={{ width: '80px' }}
          />
          <span style={{ color: 'var(--linear-secondary-400)' }}>%</span>
        </div>
      </div>
      <p style={{ marginTop: '16px' }}>
        Selected Frame: {selectedFrame}컷
      </p>
      <p>Template: {template ? `${template.name} (${template.id})` : "none"}</p>
    </div>
  );
};

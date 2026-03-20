import React from 'react'

export type DesktopPanel = 'frames' | 'text' | 'sticker' | null;

export type DesktopNavigationRailProps = {
  activePanel: DesktopPanel;
  onTogglePanel: (panel: Exclude<DesktopPanel, null>) => void;
  onExport: () => void;
  tutorialStep: number | null;
  frameButtonRef: React.Ref<HTMLButtonElement>;
  textButtonRef: React.Ref<HTMLButtonElement>;
  stickerButtonRef: React.Ref<HTMLButtonElement>;
  saveButtonRef: React.Ref<HTMLButtonElement>;
};

const railButtonStyle = (isActive: boolean): React.CSSProperties => ({
  background: isActive ? 'var(--linear-neutral-50)' : 'transparent',
  color: isActive ? 'var(--linear-neutral-600)' : 'var(--linear-secondary-300)',
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
  fontFamily: 'var(--linear-font-family)',
});

export const DesktopNavigationRail: React.FC<DesktopNavigationRailProps> = ({
  activePanel,
  onTogglePanel,
  onExport,
  tutorialStep,
  frameButtonRef,
  textButtonRef,
  stickerButtonRef,
  saveButtonRef,
}) => {
  return (
    <aside
      className="linear-card"
      style={{
        width: '75px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 8px',
        flexShrink: 0,
      }}
    >
      <button
        ref={frameButtonRef}
        type="button"
        onClick={() => onTogglePanel('frames')}
        style={railButtonStyle(activePanel === 'frames')}
        className={tutorialStep === 0 ? 'tutorial-highlight' : undefined}
      >
        <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>프레임</span>
      </button>

      <button
        ref={textButtonRef}
        type="button"
        onClick={() => onTogglePanel('text')}
        style={railButtonStyle(activePanel === 'text')}
        className={tutorialStep === 1 ? 'tutorial-highlight' : undefined}
      >
        <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>글씨</span>
      </button>

      <button
        ref={stickerButtonRef}
        type="button"
        onClick={() => onTogglePanel('sticker')}
        style={railButtonStyle(activePanel === 'sticker')}
        className={tutorialStep === 2 ? 'tutorial-highlight' : undefined}
      >
        <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>스티커</span>
      </button>

      <div style={{ flex: 1 }} />

      <button
        ref={saveButtonRef}
        type="button"
        className={`linear-button linear-button--primary${tutorialStep === 3 ? ' tutorial-highlight' : ''}`}
        onClick={onExport}
        style={{ width: '100%', height: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: 0 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>저장</span>
      </button>
    </aside>
  );
};

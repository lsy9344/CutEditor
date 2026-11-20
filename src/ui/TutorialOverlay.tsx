import React, { useEffect, useRef, useState } from 'react';
import { getWrappedFocusIndex } from '../state/modalFocus';

type Step = {
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    title: '① 프레임 고르기',
    description: '사진 몇 장으로 만들지 골라요.\n빈 칸을 누르면 사진을 넣을 수 있어요.',
  },
  {
    title: '② 글씨 넣기',
    description: '사진 위에 글씨를 쓸 수 있어요.',
  },
  {
    title: '③ 스티커 붙이기',
    description: '스티커를 누르면 사진에 붙어요.',
  },
  {
    title: '④ 저장',
    description: '다 꾸몄으면 [저장]을 눌러요.',
  },
];

const TOOLTIP_WIDTH = 224;
const MARGIN = 16;
const ARROW_CLAMP = 20; // 화살표가 툴팁 모서리에서 최소 이 만큼 안쪽

type Layout = {
  top: number;
  left: number;
  arrowOffset: number; // 데스크톱: top px / 모바일: left px
};

type Props = {
  step: number;
  buttonRefs: React.RefObject<HTMLButtonElement | null>[];
  onNext: () => void;
  onSkip: () => void;
  mobile?: boolean;
};

export const TutorialOverlay: React.FC<Props> = ({ step, buttonRefs, onNext, onSkip, mobile = false }) => {
  const [layout, setLayout] = useState<Layout>({ top: MARGIN, left: 85, arrowOffset: 80 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 튜토리얼 상자 안에서만 Tab이 돌고, Esc로 건너뜁니다(설계 6.5, 4.8)
  const handleTooltipKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onSkip();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    const focusMove = getWrappedFocusIndex({
      focusableCount: buttons.length,
      activeIndex: buttons.findIndex((button) => button === document.activeElement),
      isShiftKey: event.shiftKey,
    });
    if (focusMove.kind === 'native') return;
    event.preventDefault();
    if (focusMove.kind === 'move') buttons[focusMove.index].focus();
  };

  useEffect(() => {
    const el = buttonRefs[step]?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tooltipH = tooltipRef.current?.offsetHeight ?? 200;

    if (mobile) {
      // 버튼 위쪽에 툴팁 배치
      const rawTop = rect.top - tooltipH - 16;
      const top = Math.max(MARGIN, rawTop);

      // 버튼 중앙 기준 수평 정렬
      const rawLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      const maxLeft = window.innerWidth - TOOLTIP_WIDTH - MARGIN;
      const left = Math.max(MARGIN, Math.min(rawLeft, maxLeft));

      // 화살표: 버튼 중심 X → 툴팁 내 상대 좌표
      const buttonCenterX = rect.left + rect.width / 2;
      const arrowOffset = Math.max(ARROW_CLAMP, Math.min(buttonCenterX - left, TOOLTIP_WIDTH - ARROW_CLAMP));

      setLayout({ top, left, arrowOffset });
    } else {
      // 버튼 오른쪽에 툴팁 배치
      const centered = rect.top + rect.height / 2 - tooltipH / 2;
      const maxTop = window.innerHeight - tooltipH - MARGIN;
      const top = Math.max(MARGIN, Math.min(centered, maxTop));

      // 화살표: 버튼 중심 Y → 툴팁 내 상대 좌표
      const buttonCenterY = rect.top + rect.height / 2;
      const arrowOffset = Math.max(ARROW_CLAMP, Math.min(buttonCenterY - top, tooltipH - ARROW_CLAMP));

      setLayout({ top, left: 85, arrowOffset });
    }
  }, [step, buttonRefs, mobile]);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* 앱 전체 차단 오버레이 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 998,
          cursor: 'default',
        }}
      />

      {/* 툴팁 박스 */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        onKeyDown={handleTooltipKeyDown}
        style={{
          position: 'fixed',
          left: `${layout.left}px`,
          top: `${layout.top}px`,
          zIndex: 1000,
          width: `${TOOLTIP_WIDTH}px`,
          background: 'var(--linear-neutral-600)',
          border: '3px solid #000',
          boxShadow: '4px 4px 0px 0px #000',
          padding: '16px',
          fontFamily: 'var(--linear-font-family)',
          transition: prefersReducedMotion ? 'none' : 'top 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 화살표 — 데스크톱: 왼쪽, 모바일: 아래쪽 */}
        {mobile ? (
          <>
            <div style={{
              position: 'absolute',
              bottom: '-11px',
              left: `${layout.arrowOffset}px`,
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '10px solid #000',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-7px',
              left: `${layout.arrowOffset}px`,
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid #fff',
            }} />
          </>
        ) : (
          <>
            <div style={{
              position: 'absolute',
              left: '-11px',
              top: `${layout.arrowOffset}px`,
              transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderRight: '10px solid #000',
            }} />
            <div style={{
              position: 'absolute',
              left: '-7px',
              top: `${layout.arrowOffset}px`,
              transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '8px solid #fff',
            }} />
          </>
        )}

        {/* 단계 표시 */}
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--linear-secondary-400)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
          {step + 1} / {STEPS.length}
        </div>

        {/* 제목 */}
        <div id="tutorial-title" style={{ fontSize: '15px', fontWeight: 800, color: '#000', lineHeight: 1.3, marginBottom: '8px' }}>
          {currentStep.title}
        </div>

        {/* 설명 */}
        <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.6, marginBottom: '14px', whiteSpace: 'pre-line' }}>
          {currentStep.description}
        </p>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="linear-button linear-button--secondary"
            onClick={onSkip}
            style={{ flex: 1, minHeight: '44px', fontSize: '14px', padding: 0 }}
          >
            건너뛰기
          </button>
          <button
            type="button"
            className="linear-button linear-button--primary"
            onClick={onNext}
            autoFocus
            style={{ flex: 1, minHeight: '44px', fontSize: '14px', padding: 0 }}
          >
            {isLast ? '시작하기' : '다음 →'}
          </button>
        </div>
      </div>
    </>
  );
};

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getWrappedFocusIndex } from '../state/modalFocus';
import {
  getTutorialDemoImage,
  getTutorialTooltipHeightWithoutDemoImage,
  getTutorialTooltipLayout,
  TUTORIAL_DEMO_IMAGE_GAP,
  TUTORIAL_TOOLTIP_BORDER,
  TUTORIAL_TOOLTIP_MARGIN,
  TUTORIAL_TOOLTIP_PADDING,
  TUTORIAL_TOOLTIP_WIDTH,
} from './tutorialSteps';
import type { TutorialPlacement, TutorialStep, TutorialTooltipLayout } from './tutorialSteps';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const readPrefersReducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia(REDUCED_MOTION_QUERY).matches;

type Props = {
  step: number;
  buttonRefs: React.RefObject<HTMLButtonElement | null>[];
  onNext: () => void;
  onSkip: () => void;
  placement: TutorialPlacement;
  steps: TutorialStep[];
};

export const TutorialOverlay: React.FC<Props> = ({ step, buttonRefs, onNext, onSkip, placement, steps }) => {
  const [layout, setLayout] = useState<TutorialTooltipLayout>({ top: TUTORIAL_TOOLTIP_MARGIN, left: 85, arrowOffset: 80 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  // 화살표는 테두리 안쪽(padding box)에서부터 놓이므로 바깥 모서리 기준 arrowOffset에서 테두리 폭을 뺍니다.
  const arrowPosition = layout.arrowOffset - TUTORIAL_TOOLTIP_BORDER;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === 'undefined' ? 0 : window.innerHeight));
  // 단계마다 그림 없이 잰 말풍선 높이. 재기 전에는 그림을 그리지 않아 들어가지 않는 창에서는 그림을 받지도 않습니다.
  const [measuredTooltip, setMeasuredTooltip] = useState<{ step: number; heightWithoutImage: number } | null>(null);

  // ④를 보는 중에 바뀐 움직임 줄이기 설정도 그 자리에서 반영합니다.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const motionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const updateReducedMotion = () => setPrefersReducedMotion(motionMedia.matches);
    updateReducedMotion();
    motionMedia.addEventListener?.('change', updateReducedMotion);
    return () => motionMedia.removeEventListener?.('change', updateReducedMotion);
  }, []);

  // 창 높이가 바뀌면 그림을 넣을지와 말풍선 자리를 다시 정합니다.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, []);

  const currentStep = steps[step];
  const demoImage = getTutorialDemoImage({
    target: currentStep.target,
    placement,
    prefersReducedMotion,
    tooltipHeightWithoutImage: measuredTooltip?.step === step ? measuredTooltip.heightWithoutImage : null,
    viewportHeight,
  });
  const isDemoImageShown = demoImage !== null;

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

  // 그리기 전에 재서 그림을 넣을지 정하고 자리를 잡습니다(그림이 생겼다 사라지며 깜박이지 않게).
  useLayoutEffect(() => {
    const el = buttonRefs[step]?.current;
    if (!el) return;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 200;
    const heightWithoutImage = getTutorialTooltipHeightWithoutDemoImage({ tooltipHeight, isDemoImageShown });
    setMeasuredTooltip((previous) => (previous?.step === step && previous.heightWithoutImage === heightWithoutImage
      ? previous
      : { step, heightWithoutImage }));
    const rect = el.getBoundingClientRect();
    setLayout(getTutorialTooltipLayout({
      placement,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      tooltipHeight,
      viewport: { width: window.innerWidth, height: viewportHeight },
    }));
  }, [step, buttonRefs, placement, viewportHeight, isDemoImageShown]);

  const isLast = step === steps.length - 1;

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
          width: `${TUTORIAL_TOOLTIP_WIDTH}px`,
          background: 'var(--linear-neutral-600)',
          border: `${TUTORIAL_TOOLTIP_BORDER}px solid #000`,
          boxShadow: '4px 4px 0px 0px #000',
          padding: `${TUTORIAL_TOOLTIP_PADDING}px`,
          fontFamily: 'var(--linear-font-family)',
          transition: prefersReducedMotion ? 'none' : 'top 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 화살표 — 데스크톱: 왼쪽, 휴대폰 세로: 아래쪽, 낮은 가로: 오른쪽 */}
        {placement === 'above' ? (
          <>
            <div style={{
              position: 'absolute',
              bottom: '-11px',
              left: `${arrowPosition}px`,
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '10px solid #000',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-7px',
              left: `${arrowPosition}px`,
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid #fff',
            }} />
          </>
        ) : placement === 'right' ? (
          <>
            <div style={{
              position: 'absolute',
              left: '-11px',
              top: `${arrowPosition}px`,
              transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderRight: '10px solid #000',
            }} />
            <div style={{
              position: 'absolute',
              left: '-7px',
              top: `${arrowPosition}px`,
              transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '8px solid #fff',
            }} />
          </>
        ) : (
          <>
            <div style={{
              position: 'absolute',
              right: '-11px',
              top: `${arrowPosition}px`,
              transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderLeft: '10px solid #000',
            }} />
            <div style={{
              position: 'absolute',
              right: '-7px',
              top: `${arrowPosition}px`,
              transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: '8px solid #fff',
            }} />
          </>
        )}

        {/* 단계 표시 */}
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--linear-secondary-400)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
          {step + 1} / {steps.length}
        </div>

        {/* 제목 */}
        <div id="tutorial-title" style={{ fontSize: '15px', fontWeight: 800, color: '#000', lineHeight: 1.3, marginBottom: '8px' }}>
          {currentStep.title}
        </div>

        {/* 설명 */}
        <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.6, marginBottom: '14px', whiteSpace: 'pre-line' }}>
          {currentStep.description}
        </p>

        {/* 시연 그림(④ 내 사진 스티커). 설명 글이 같은 내용을 말하므로 장식 그림입니다. */}
        {demoImage && (
          <img
            src={demoImage.src}
            width={demoImage.width}
            height={demoImage.height}
            alt=""
            style={{ display: 'block', width: `${demoImage.width}px`, height: `${demoImage.height}px`, marginBottom: `${TUTORIAL_DEMO_IMAGE_GAP}px` }}
          />
        )}

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

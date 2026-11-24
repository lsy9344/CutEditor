import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getWrappedFocusIndex } from '../state/modalFocus';
import {
  getTutorialDemoImage,
  getTutorialTooltipLayout,
  getTutorialTooltipTransition,
  isTutorialDemoTarget,
  TUTORIAL_DEMO_IMAGE_GAP,
  TUTORIAL_TOOLTIP_BORDER,
  TUTORIAL_TOOLTIP_MARGIN,
  TUTORIAL_TOOLTIP_PADDING,
  TUTORIAL_TOOLTIP_WIDTH,
} from './tutorialSteps';
import type { TutorialPlacement, TutorialStep, TutorialTooltipLayout } from './tutorialSteps';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// 말풍선 상자 모양. 그림 없는 높이를 재는 숨은 사본도 같은 모양이어야 높이가 맞습니다.
const TOOLTIP_BOX_STYLE: React.CSSProperties = {
  width: `${TUTORIAL_TOOLTIP_WIDTH}px`,
  background: 'var(--linear-neutral-600)',
  border: `${TUTORIAL_TOOLTIP_BORDER}px solid #000`,
  boxShadow: '4px 4px 0px 0px #000',
  padding: `${TUTORIAL_TOOLTIP_PADDING}px`,
  fontFamily: 'var(--linear-font-family)',
};

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
  // ①~④ 말풍선을 그림 없이 잰 높이(숨은 사본에서 잼). 재기 전에는 그림을 그리지 않아 들어가지 않는 창에서는 그림을 받지도 않습니다.
  const [demoTooltipHeights, setDemoTooltipHeights] = useState<number[] | null>(null);
  const demoMeasureRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 바로 앞 자리 잡기 때 그림이 보였는지. 이번에 달라졌으면 말풍선을 옮기는 동안 버튼이 잘리지 않게 바로 놓습니다.
  const wasDemoImageShownRef = useRef(false);
  const [isDemoImageToggled, setIsDemoImageToggled] = useState(false);

  // 시연 그림을 보는 중에 바뀐 움직임 줄이기 설정도 그 자리에서 반영합니다.
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
  const demoStepIndexes = steps.flatMap((tutorialStep, index) => (isTutorialDemoTarget(tutorialStep.target) ? [index] : []));
  const demoImage = getTutorialDemoImage({
    target: currentStep.target,
    placement,
    prefersReducedMotion,
    demoTooltipHeights,
    viewportHeight,
  });
  const isDemoImageShown = demoImage !== null;
  const demoStepIndexCount = demoStepIndexes.length;

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
    const measuredHeights = demoMeasureRefs.current.slice(0, demoStepIndexCount).map((copy) => copy?.offsetHeight ?? 0);
    setDemoTooltipHeights((previous) => (previous && previous.join() === measuredHeights.join() ? previous : measuredHeights));
    setIsDemoImageToggled(wasDemoImageShownRef.current !== isDemoImageShown);
    wasDemoImageShownRef.current = isDemoImageShown;
    const rect = el.getBoundingClientRect();
    setLayout(getTutorialTooltipLayout({
      placement,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      tooltipHeight,
      viewport: { width: window.innerWidth, height: viewportHeight },
    }));
  }, [step, buttonRefs, placement, viewportHeight, isDemoImageShown, demoStepIndexCount]);

  // 단계 표시·제목·설명. 숨은 사본은 같은 글로 높이만 재므로 제목 id를 두지 않습니다.
  const renderStepText = (stepIndex: number, titleId?: string) => (
    <>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--linear-secondary-400)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
        {stepIndex + 1} / {steps.length}
      </div>
      <div id={titleId} style={{ fontSize: '15px', fontWeight: 800, color: '#000', lineHeight: 1.3, marginBottom: '8px' }}>
        {steps[stepIndex].title}
      </div>
      <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.6, marginBottom: '14px', whiteSpace: 'pre-line' }}>
        {steps[stepIndex].description}
      </p>
    </>
  );

  // [건너뛰기]·[다음]. 숨은 사본의 버튼은 누를 수도 고를 수도 없습니다(visibility: hidden, tabIndex -1).
  const renderButtons = (stepIndex: number, isMeasureCopy: boolean) => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        type="button"
        className="linear-button linear-button--secondary"
        onClick={isMeasureCopy ? undefined : onSkip}
        tabIndex={isMeasureCopy ? -1 : undefined}
        style={{ flex: 1, minHeight: '44px', fontSize: '14px', padding: 0 }}
      >
        건너뛰기
      </button>
      <button
        type="button"
        className="linear-button linear-button--primary"
        onClick={isMeasureCopy ? undefined : onNext}
        tabIndex={isMeasureCopy ? -1 : undefined}
        autoFocus={!isMeasureCopy}
        style={{ flex: 1, minHeight: '44px', fontSize: '14px', padding: 0 }}
      >
        {stepIndex === steps.length - 1 ? '시작하기' : '다음 →'}
      </button>
    </div>
  );

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
          ...TOOLTIP_BOX_STYLE,
          position: 'fixed',
          left: `${layout.left}px`,
          top: `${layout.top}px`,
          zIndex: 1000,
          transition: getTutorialTooltipTransition({ prefersReducedMotion, isDemoImageToggled }),
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

        {renderStepText(step, 'tutorial-title')}

        {/* 시연 그림(①~④ 단계). 설명 글이 같은 내용을 말하므로 장식 그림입니다. */}
        {demoImage && (
          <img
            src={demoImage.src}
            width={demoImage.width}
            height={demoImage.height}
            alt=""
            style={{ display: 'block', width: `${demoImage.width}px`, height: `${demoImage.height}px`, marginBottom: `${TUTORIAL_DEMO_IMAGE_GAP}px` }}
          />
        )}

        {renderButtons(step, false)}
      </div>

      {/* ①~④ 말풍선을 그림 없이 그린 숨은 사본. 가장 높은 것으로 그림을 넣을지 한 번에 정합니다. */}
      {demoStepIndexes.map((demoStepIndex, order) => (
        <div
          key={demoStepIndex}
          ref={(copy) => { demoMeasureRefs.current[order] = copy; }}
          aria-hidden="true"
          style={{ ...TOOLTIP_BOX_STYLE, position: 'fixed', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' }}
        >
          {renderStepText(demoStepIndex)}
          {renderButtons(demoStepIndex, true)}
        </div>
      ))}
    </>
  );
};

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getWrappedFocusIndex } from '../state/modalFocus';
import {
  getTutorialCardScrollDelta,
  getTutorialDemoImage,
  getTutorialPlacement,
  getTutorialTooltipLayout,
  getTutorialTooltipTransition,
  isTutorialCardTarget,
  isTutorialDemoTarget,
  TUTORIAL_CARD_MIN_VISIBLE,
  TUTORIAL_DEMO_IMAGE_GAP,
  TUTORIAL_TOOLTIP_BORDER,
  TUTORIAL_TOOLTIP_MARGIN,
  TUTORIAL_TOOLTIP_PADDING,
  TUTORIAL_TOOLTIP_WIDTH,
} from './tutorialSteps';
import type { TutorialPlacement, TutorialScreen, TutorialStep, TutorialTooltipLayout } from './tutorialSteps';

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

// 가장 가까운 세로 스크롤 조상(없으면 문서). 편집 카드는 데스크톱에서는 카드 안이, 휴대폰에서는 문서가 굴러갑니다.
const getScrollParent = (element: HTMLElement): Element => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return document.scrollingElement ?? document.documentElement;
};

const readPrefersReducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia(REDUCED_MOTION_QUERY).matches;

type Props = {
  step: number;
  // 단계마다 가리킬 곳의 후보. 화면에 있는 첫 후보를 가리킵니다(예: 편집 카드의 그 구획, 없으면 카드 전체). 다 없으면 가운데입니다.
  targetRefs: React.RefObject<HTMLElement | null>[][];
  onNext: () => void;
  onSkip: () => void;
  screen: TutorialScreen;
  steps: TutorialStep[];
};

type PlacedLayout = TutorialTooltipLayout & { placement: TutorialPlacement };

export const TutorialOverlay: React.FC<Props> = ({ step, targetRefs, onNext, onSkip, screen, steps }) => {
  const [layout, setLayout] = useState<PlacedLayout>({ top: TUTORIAL_TOOLTIP_MARGIN, left: 85, arrowOffset: 80, placement: 'center' });
  const tooltipRef = useRef<HTMLDivElement>(null);
  // 화살표는 테두리 안쪽(padding box)에서부터 놓이므로 바깥 모서리 기준 arrowOffset에서 테두리 폭을 뺍니다.
  const arrowPosition = layout.arrowOffset - TUTORIAL_TOOLTIP_BORDER;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPrefersReducedMotion);
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === 'undefined' ? 0 : window.innerHeight));
  // 시연 단계 말풍선을 그림 없이 잰 높이(숨은 사본에서 잼). 재기 전에는 그림을 그리지 않아 들어가지 않는 창에서는 그림을 받지도 않습니다.
  const [demoTooltipHeights, setDemoTooltipHeights] = useState<number[] | null>(null);
  const demoMeasureRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 바로 앞 자리 잡기 때 그림이 보였는지. 이번에 달라졌으면 말풍선을 옮기는 동안 버튼이 잘리지 않게 바로 놓습니다.
  const wasDemoImageShownRef = useRef(false);
  const [isDemoImageToggled, setIsDemoImageToggled] = useState(false);
  // 바로 앞 자리 잡기의 자리 종류. 바뀌었으면(레일 옆 ↔ 가운데 ↔ 카드 옆) 말풍선을 옮기지 않고 바로 놓습니다.
  const placementRef = useRef<TutorialPlacement | null>(null);
  const [isPlacementChanged, setIsPlacementChanged] = useState(false);
  // 휴대폰 세로 편집기(카드가 있음)에서 말풍선 아래에 남길 높이: 툴바 + 툴바 위로 보일 카드 구획. 그 밖에는 0입니다.
  const [bottomReserve, setBottomReserve] = useState(0);

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
    screen,
    prefersReducedMotion,
    demoTooltipHeights,
    viewportHeight,
    bottomReserve,
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
    const target = currentStep.target;
    const element = targetRefs[step]?.map((ref) => ref.current).find((candidate) => candidate !== null) ?? null;
    const placement = getTutorialPlacement({ target, screen, hasTargetElement: element !== null });
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 200;
    // 편집 카드 단계는 가리킬 구획이 보이게 카드를 굴립니다(휴대폰 세로는 구획이 말풍선 바로 아래에 오게).
    if (element && isTutorialCardTarget(target)) {
      const elementRect = element.getBoundingClientRect();
      const scrollDelta = getTutorialCardScrollDelta({ placement, rect: elementRect, tooltipHeight, viewportHeight });
      if (scrollDelta !== 0) getScrollParent(element).scrollTop += scrollDelta;
    }
    const measuredHeights = demoMeasureRefs.current.slice(0, demoStepIndexCount).map((copy) => copy?.offsetHeight ?? 0);
    setDemoTooltipHeights((previous) => (previous && previous.join() === measuredHeights.join() ? previous : measuredHeights));
    setIsDemoImageToggled(wasDemoImageShownRef.current !== isDemoImageShown);
    wasDemoImageShownRef.current = isDemoImageShown;
    // 툴바 높이는 메뉴 단계가 가리키는 툴바 버튼 윗변으로 잽니다.
    const hasCard = steps.some((tutorialStep, index) => isTutorialCardTarget(tutorialStep.target) && targetRefs[index]?.some((ref) => ref.current !== null));
    const toolbarTops = steps.flatMap((tutorialStep, index) => (isTutorialCardTarget(tutorialStep.target)
      ? []
      : (targetRefs[index] ?? []).flatMap((ref) => (ref.current ? [ref.current.getBoundingClientRect().top] : []))));
    const nextBottomReserve = screen === 'phonePortrait' && hasCard && toolbarTops.length > 0
      ? Math.max(0, viewportHeight - Math.min(...toolbarTops)) + TUTORIAL_CARD_MIN_VISIBLE
      : 0;
    setBottomReserve((previous) => (Math.abs(previous - nextBottomReserve) < 1 ? previous : nextBottomReserve));
    setIsPlacementChanged(placementRef.current !== placement);
    placementRef.current = placement;
    const rect = element?.getBoundingClientRect() ?? null;
    setLayout({
      ...getTutorialTooltipLayout({
        placement,
        rect: rect && { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        tooltipHeight,
        viewport: { width: window.innerWidth, height: viewportHeight },
      }),
      placement,
    });
  }, [step, currentStep.target, steps, targetRefs, screen, viewportHeight, isDemoImageShown, demoStepIndexCount]);

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
          transition: getTutorialTooltipTransition({ prefersReducedMotion, isDemoImageToggled, isPlacementChanged }),
        }}
      >
        {/* 화살표 — 레일 오른쪽: 왼쪽, 대상 위: 아래쪽, 대상 왼쪽: 오른쪽, 가운데: 없음 */}
        {layout.placement === 'center' ? null : layout.placement === 'above' ? (
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
        ) : layout.placement === 'right' ? (
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

        {/* 시연 그림(저장을 뺀 단계). 설명 글이 같은 내용을 말하므로 장식 그림입니다. */}
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

      {/* 시연 단계 말풍선을 그림 없이 그린 숨은 사본. 가장 높은 것으로 그림을 넣을지 한 번에 정합니다. */}
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

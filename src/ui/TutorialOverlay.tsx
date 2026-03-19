import React, { useEffect, useState } from 'react';

type Step = {
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    title: '① 프레임 선택',
    description: '컷 수와 레이아웃 스타일을 골라요.\n2컷, 4컷, 9컷 등 다양한 구성을 지원해요.',
  },
  {
    title: '② 글씨 추가',
    description: '사진 위에 레터링을 올릴 수 있어요.\n폰트, 색상, 크기를 자유롭게 바꿔보세요.',
  },
  {
    title: '③ 스티커 꾸미기',
    description: '귀여운 스티커로 사진을 꾸며요.\n드래그해서 원하는 위치에 놓으세요.',
  },
];

const TOOLTIP_WIDTH = 224;
const TOOLTIP_HEIGHT = 178;
const MARGIN = 12;

type Props = {
  step: number;
  buttonRefs: React.RefObject<HTMLButtonElement | null>[];
  onNext: () => void;
  onSkip: () => void;
  mobile?: boolean;
};

export const TutorialOverlay: React.FC<Props> = ({ step, buttonRefs, onNext, onSkip, mobile = false }) => {
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: MARGIN, left: 85 });

  useEffect(() => {
    const el = buttonRefs[step]?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    if (mobile) {
      // 버튼 위쪽에 툴팁 배치
      const rawTop = rect.top - TOOLTIP_HEIGHT - 16;
      const top = Math.max(MARGIN, rawTop);

      // 버튼 중앙 기준 수평 정렬, 뷰포트 안으로 clamp
      const rawLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      const maxLeft = window.innerWidth - TOOLTIP_WIDTH - MARGIN;
      const left = Math.max(MARGIN, Math.min(rawLeft, maxLeft));

      setTooltipPos({ top, left });
    } else {
      // 버튼 오른쪽에 툴팁 배치
      const centered = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2;
      const maxTop = window.innerHeight - TOOLTIP_HEIGHT - MARGIN;
      setTooltipPos({ top: Math.max(MARGIN, Math.min(centered, maxTop)), left: 85 });
    }
  }, [step, buttonRefs, mobile]);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // 모바일: 아래 화살표, 데스크톱: 왼쪽 화살표
  const arrowOuter = mobile
    ? {
        position: 'absolute' as const,
        bottom: '-11px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '10px solid transparent',
        borderRight: '10px solid transparent',
        borderTop: '10px solid #000',
      }
    : {
        position: 'absolute' as const,
        left: '-11px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 0,
        height: 0,
        borderTop: '10px solid transparent',
        borderBottom: '10px solid transparent',
        borderRight: '10px solid #000',
      };

  const arrowInner = mobile
    ? {
        position: 'absolute' as const,
        bottom: '-7px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '8px solid #fff',
      }
    : {
        position: 'absolute' as const,
        left: '-7px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 0,
        height: 0,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderRight: '8px solid #fff',
      };

  return (
    <>
      {/* 앱 전체 차단 오버레이 — 클릭해도 닫히지 않음 */}
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
        style={{
          position: 'fixed',
          left: `${tooltipPos.left}px`,
          top: `${tooltipPos.top}px`,
          zIndex: 1000,
          width: `${TOOLTIP_WIDTH}px`,
          background: 'var(--linear-neutral-600)',
          border: '3px solid #000',
          boxShadow: '4px 4px 0px 0px #000',
          padding: '16px',
          fontFamily: 'var(--linear-font-family)',
          transition: 'top 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={arrowOuter} />
        <div style={arrowInner} />

        {/* 단계 표시 */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '6px',
          }}
        >
          {step + 1} / {STEPS.length}
        </div>

        {/* 제목 */}
        <div
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: '#000',
            lineHeight: 1.3,
            marginBottom: '8px',
          }}
        >
          {currentStep.title}
        </div>

        {/* 설명 */}
        <p
          style={{
            fontSize: '13px',
            color: '#333',
            lineHeight: 1.6,
            marginBottom: '14px',
            whiteSpace: 'pre-line',
          }}
        >
          {currentStep.description}
        </p>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="linear-button linear-button--secondary"
            onClick={onSkip}
            style={{ flex: 1, height: '36px', fontSize: '12px', padding: 0 }}
          >
            건너뛰기
          </button>
          <button
            className="linear-button linear-button--primary"
            onClick={onNext}
            style={{ flex: 1, height: '36px', fontSize: '12px', padding: 0 }}
          >
            {isLast ? '시작하기' : '다음 →'}
          </button>
        </div>
      </div>
    </>
  );
};

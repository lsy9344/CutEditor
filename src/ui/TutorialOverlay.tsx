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

type Props = {
  step: number;
  buttonRefs: React.RefObject<HTMLButtonElement | null>[];
  onNext: () => void;
  onSkip: () => void;
};

export const TutorialOverlay: React.FC<Props> = ({ step, buttonRefs, onNext, onSkip }) => {
  const [tooltipTop, setTooltipTop] = useState<number>(100);
  const tooltipHeight = 170;

  useEffect(() => {
    const el = buttonRefs[step]?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipTop(rect.top + rect.height / 2 - tooltipHeight / 2);
  }, [step, buttonRefs]);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* 반투명 배경 오버레이 (클릭 방지) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 998,
        }}
        onClick={onSkip}
      />

      {/* 툴팁 박스 */}
      <div
        style={{
          position: 'fixed',
          left: '85px',
          top: `${tooltipTop}px`,
          zIndex: 1000,
          width: '220px',
          background: 'var(--linear-neutral-600)',
          border: '3px solid #000',
          boxShadow: '4px 4px 0px 0px #000',
          padding: '16px',
          fontFamily: 'var(--linear-font-family)',
          transition: 'top 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 왼쪽 화살표 (버튼 방향) */}
        <div
          style={{
            position: 'absolute',
            left: '-11px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            borderRight: '10px solid #000',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '-7px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '8px solid #fff',
          }}
        />

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

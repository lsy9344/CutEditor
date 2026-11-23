export type TutorialTarget = "frames" | "text" | "sticker" | "cutout" | "save";
export type TutorialStep = { target: TutorialTarget; title: string; description: string };

// 튜토리얼 단계(설계 8장). 누끼 기능이 꺼져 있으면 네 단계이고 마지막이 '④ 저장'입니다.
export const getTutorialSteps = ({ hasCutoutMenu }: { hasCutoutMenu: boolean }): TutorialStep[] => {
  const baseSteps: TutorialStep[] = [
    { target: "frames", title: "① 프레임 고르기", description: "사진 몇 장으로 만들지 골라요.\n빈 칸을 누르면 사진을 넣을 수 있어요." },
    { target: "text", title: "② 글씨 넣기", description: "사진 위에 글씨를 쓸 수 있어요." },
    { target: "sticker", title: "③ 스티커 붙이기", description: "스티커를 누르면 사진에 붙어요." },
  ];
  if (!hasCutoutMenu) {
    return [...baseSteps, { target: "save", title: "④ 저장", description: "다 꾸몄으면 [저장]을 눌러요." }];
  }
  return [
    ...baseSteps,
    { target: "cutout", title: "④ 내 사진 스티커 만들기", description: "넣은 사진을 오려서 스티커로 붙일 수 있어요." },
    { target: "save", title: "⑤ 저장", description: "다 꾸몄으면 [저장]을 눌러요." },
  ];
};

// 다음 단계. 마지막이면 null(닫힘)입니다.
export const getNextTutorialStep = ({ step, stepCount }: { step: number; stepCount: number }): number | null =>
  step + 1 >= stepCount ? null : step + 1;

export type TutorialPlacement = "above" | "left" | "right";
export type TutorialTooltipLayout = { top: number; left: number; arrowOffset: number };

export const TUTORIAL_TOOLTIP_WIDTH = 224;
// 말풍선 테두리와 안쪽 여백. 폭은 border-box라 내용 폭은 224 - 3×2 - 16×2 = 186px입니다.
export const TUTORIAL_TOOLTIP_BORDER = 3;
export const TUTORIAL_TOOLTIP_PADDING = 16;
const DEMO_IMAGE_WIDTH = TUTORIAL_TOOLTIP_WIDTH - TUTORIAL_TOOLTIP_BORDER * 2 - TUTORIAL_TOOLTIP_PADDING * 2;
const DEMO_IMAGE_HEIGHT = 132; // 파일은 2배(372×264)

export type TutorialDemoImage = { src: string; width: number; height: number };

// ④ 내 사진 스티커 단계의 시연 그림(scripts/build-tutorial-cutout-demo.mjs로 만듦). 그 단계에서만 그려서 다른 단계와
// 건너뛴 손님은 받지 않습니다. 크기는 말풍선 내용 폭에 맞춰 고정해 그림이 늦게 와도 말풍선이 흔들리지 않습니다.
export const getTutorialDemoImage = ({ target, placement, prefersReducedMotion }: {
  target: TutorialTarget;
  placement: TutorialPlacement;
  prefersReducedMotion: boolean;
}): TutorialDemoImage | null => {
  if (target !== "cutout") return null;
  // 낮은 가로는 말풍선이 이미 화면 높이를 거의 채워 그림을 넣으면 버튼을 가립니다.
  if (placement === "left") return null;
  // 움직임 줄이기 설정이면 마지막 결과 장면 한 장만 보입니다.
  const src = prefersReducedMotion ? "/tutorial/cutout-demo-still.png" : "/tutorial/cutout-demo.webp";
  return { src, width: DEMO_IMAGE_WIDTH, height: DEMO_IMAGE_HEIGHT };
};

const TOOLTIP_MARGIN = 16;
const ARROW_CLAMP = 20; // 화살표가 말풍선 모서리에서 최소 이만큼 안쪽
const RAIL_TOOLTIP_LEFT = 85;

// 말풍선 자리(1.6 권장 3). 'above'는 버튼 위(휴대폰 세로), 'left'는 버튼 왼쪽(낮은 가로의 오른쪽 세로 툴바),
// 'right'는 레일 오른쪽(데스크톱). arrowOffset은 'above'에서 가로 px, 나머지는 세로 px입니다.
export const getTutorialTooltipLayout = ({ placement, rect, tooltipHeight, viewport }: {
  placement: TutorialPlacement;
  rect: { top: number; left: number; width: number; height: number };
  tooltipHeight: number;
  viewport: { width: number; height: number };
}): TutorialTooltipLayout => {
  if (placement === "above") {
    const top = Math.max(TOOLTIP_MARGIN, rect.top - tooltipHeight - TOOLTIP_MARGIN);
    const rawLeft = rect.left + rect.width / 2 - TUTORIAL_TOOLTIP_WIDTH / 2;
    const left = Math.max(TOOLTIP_MARGIN, Math.min(rawLeft, viewport.width - TUTORIAL_TOOLTIP_WIDTH - TOOLTIP_MARGIN));
    const buttonCenterX = rect.left + rect.width / 2;
    const arrowOffset = Math.max(ARROW_CLAMP, Math.min(buttonCenterX - left, TUTORIAL_TOOLTIP_WIDTH - ARROW_CLAMP));
    return { top, left, arrowOffset };
  }
  const centeredTop = rect.top + rect.height / 2 - tooltipHeight / 2;
  const top = Math.max(TOOLTIP_MARGIN, Math.min(centeredTop, viewport.height - tooltipHeight - TOOLTIP_MARGIN));
  const buttonCenterY = rect.top + rect.height / 2;
  const arrowOffset = Math.max(ARROW_CLAMP, Math.min(buttonCenterY - top, tooltipHeight - ARROW_CLAMP));
  const left = placement === "right"
    ? RAIL_TOOLTIP_LEFT
    : Math.max(TOOLTIP_MARGIN, rect.left - TUTORIAL_TOOLTIP_WIDTH - TOOLTIP_MARGIN);
  return { top, left, arrowOffset };
};

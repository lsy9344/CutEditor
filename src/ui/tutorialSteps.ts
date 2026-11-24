import type { PhotoEditSections } from "../photo/photoEditFeatures";

// 왼쪽 메뉴(데스크톱 레일·휴대폰 툴바) 버튼을 가리키는 단계와 오른쪽 편집 카드를 가리키는 단계
export type TutorialMenuTarget = "frames" | "text" | "sticker" | "cutout" | "save";
export type TutorialCardTarget = "erase" | "color" | "frameColor";
export type TutorialTarget = TutorialMenuTarget | TutorialCardTarget;
export type TutorialStep = { target: TutorialTarget; title: string; description: string };

const STEP_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

// 튜토리얼 단계(설계 8장). 왼쪽 메뉴 ①~④ 뒤에 오른쪽 편집 카드 단계가 오고, 다 꾸민 뒤 누르는 저장이 맨 끝입니다.
// 누끼 메뉴나 바닥 얼룩 지우기·사진 색 구획이 꺼진 구성은 그 단계를 빼고 번호를 당깁니다.
// 카드 단계 글은 기기와 무관하게 그 기능이 나타나는 조건('사진 칸을 고르면', '프레임을 고르면')을 알려 줍니다.
// 첫 화면(칸 고르기)에는 카드가 없습니다. isFrameColorLocked는 지금 프레임이 색을 바꿀 수 없는 경우(1컷 '사진에 글씨새기기')입니다.
export const getTutorialSteps = ({ hasCutoutMenu, photoEditSections, isFrameColorLocked = false }: {
  hasCutoutMenu: boolean;
  photoEditSections: Pick<PhotoEditSections, "showErase" | "showAdjust">;
  isFrameColorLocked?: boolean;
}): TutorialStep[] => {
  const steps: { target: TutorialTarget; name: string; description: string }[] = [
    { target: "frames", name: "프레임 고르기", description: "사진 몇 장으로 만들지 골라요.\n빈 칸을 누르면 사진을 넣을 수 있어요." },
    { target: "text", name: "글씨 넣기", description: "사진 위에 글씨를 쓸 수 있어요." },
    { target: "sticker", name: "스티커 붙이기", description: "스티커를 누르면 사진에 붙어요." },
    ...(hasCutoutMenu ? [{ target: "cutout" as const, name: "내 사진 스티커 만들기", description: "넣은 사진을 오려서 스티커로 붙일 수 있어요." }] : []),
    ...(photoEditSections.showErase ? [{
      target: "erase" as const,
      name: "바닥 얼룩 지우기",
      description: "사진 칸을 고르면 나오는 편집 카드에서 [바닥 얼룩 지우기]를 눌러요.\n얼룩을 칠하면 지워져요.",
    }] : []),
    ...(photoEditSections.showAdjust ? [{
      target: "color" as const,
      name: "사진 색",
      description: "사진 칸을 고르면 나오는 편집 카드의 [사진 색]에서 고르거나 [자세히]에서 밝기·선명하게·색감·따뜻함을 맞춰요.",
    }] : []),
    {
      target: "frameColor",
      name: "프레임 색",
      description: isFrameColorLocked
        ? "이 프레임은 색을 바꿀 수 없어요.\n다른 프레임에서는 [프레임 색 바꾸기]로 바꿔요."
        : "프레임을 고르면 나오는 편집 카드에서 [프레임 색 바꾸기]를 누르고 색을 골라요.",
    },
    { target: "save", name: "저장", description: "다 꾸몄으면 [저장]을 눌러요." },
  ];
  return steps.map(({ target, name, description }, index) => ({ target, title: `${STEP_NUMBERS[index]} ${name}`, description }));
};

// 다음 단계. 마지막이면 null(닫힘)입니다.
export const getNextTutorialStep = ({ step, stepCount }: { step: number; stepCount: number }): number | null =>
  step + 1 >= stepCount ? null : step + 1;

// 'center'는 가리킬 곳이 화면에 없을 때(첫 화면 칸 고르기에는 편집 카드가 없음) 꼬리 없이 화면 가운데입니다.
export type TutorialPlacement = "above" | "left" | "right" | "center";
// 화면 배치: 데스크톱(왼쪽 레일), 휴대폰 세로(아래 툴바), 낮은 가로(오른쪽 세로 툴바)
export type TutorialScreen = "desktop" | "phonePortrait" | "shortLandscape";
export type TutorialTooltipLayout = { top: number; left: number; arrowOffset: number };

export const TUTORIAL_TOOLTIP_WIDTH = 224;
// 말풍선 테두리와 안쪽 여백. 폭은 border-box라 내용 폭은 224 - 3×2 - 16×2 = 186px입니다.
export const TUTORIAL_TOOLTIP_BORDER = 3;
export const TUTORIAL_TOOLTIP_PADDING = 16;
const DEMO_IMAGE_WIDTH = TUTORIAL_TOOLTIP_WIDTH - TUTORIAL_TOOLTIP_BORDER * 2 - TUTORIAL_TOOLTIP_PADDING * 2;
const DEMO_IMAGE_HEIGHT = 196; // 파일은 2배(372×392). 왼쪽 목록과 오른쪽 9:16 인화지가 들어가는 높이
export const TUTORIAL_DEMO_IMAGE_GAP = 14; // 그림 아래 여백
const DEMO_IMAGE_BLOCK_HEIGHT = DEMO_IMAGE_HEIGHT + TUTORIAL_DEMO_IMAGE_GAP; // 그림이 말풍선에 더하는 높이
export const TUTORIAL_TOOLTIP_MARGIN = 16; // 말풍선과 화면 가장자리 사이
export const TUTORIAL_CARD_MIN_VISIBLE = 48; // 휴대폰 세로 편집기에서 말풍선 아래·툴바 위로 보여야 할 카드 구획 높이

// 말풍선이 아래 여백을 남기는 가장 낮은 top. 이것이 위 여백보다 위면 말풍선이 화면에 다 들어가지 않습니다.
// 배치 계산(getTutorialTooltipLayout)과 그림을 넣을지 판단이 같은 기준을 씁니다.
const getLowestTooltipTop = (tooltipHeight: number, viewportHeight: number) =>
  viewportHeight - tooltipHeight - TUTORIAL_TOOLTIP_MARGIN;

export type TutorialDemoImage = { src: string; width: number; height: number };

// 시연 그림이 있는 단계(scripts/build-tutorial-demos.mjs로 만듦). 저장은 글만 둡니다.
// 표의 키가 대상 이름과 정확히 같아야 해서(빠지거나 남으면 tsc 오류) 대상이 늘어도 목록이 어긋나지 않습니다.
const DEMO_TARGETS: Record<Exclude<TutorialTarget, "save">, true> = {
  frames: true, text: true, sticker: true, cutout: true, erase: true, color: true, frameColor: true,
};
export const isTutorialDemoTarget = (target: TutorialTarget): boolean => Object.prototype.hasOwnProperty.call(DEMO_TARGETS, target);

const CARD_TARGETS: Record<TutorialCardTarget, true> = { erase: true, color: true, frameColor: true };
export const isTutorialCardTarget = (target: TutorialTarget): target is TutorialCardTarget => Object.prototype.hasOwnProperty.call(CARD_TARGETS, target);

// 단계별 말풍선 자리. 왼쪽 메뉴 단계는 화면마다 메뉴 버튼 옆(데스크톱 레일 오른쪽, 휴대폰 세로 툴바 위, 낮은 가로 툴바 왼쪽)이고,
// 편집 카드 단계는 카드 옆(데스크톱·낮은 가로는 캔버스 오른쪽 카드의 왼쪽, 휴대폰 세로는 캔버스 아래 카드의 위)입니다.
// 가리킬 곳이 화면에 없으면 가운데입니다.
export const getTutorialPlacement = ({ target, screen, hasTargetElement }: {
  target: TutorialTarget;
  screen: TutorialScreen;
  hasTargetElement: boolean;
}): TutorialPlacement => {
  if (!hasTargetElement) return "center";
  if (screen === "phonePortrait") return "above";
  if (isTutorialCardTarget(target) || screen === "shortLandscape") return "left";
  return "right";
};

// 휴대폰 세로(위 배치)에서 카드 구획이 보이기 시작하는 높이: 말풍선 아래, 그리고 위에 고정된 캔버스·되돌리기 줄(visibleTop) 아래
const getCardVisibleTop = (tooltipHeight: number, visibleTop: number) =>
  Math.max(tooltipHeight + TUTORIAL_TOOLTIP_MARGIN * 2, visibleTop);

// 편집 카드 단계에서 가리킬 구획이 보이게 카드를 굴릴 양(px, 양수면 내용이 위로 올라감). 휴대폰 세로(위 배치)는
// 구획 윗변이 말풍선과 고정 캔버스 바로 아래에 오게 하고(가려지지 않게), 옆 배치는 화면 밖일 때만 가장 가까운 만큼 굴립니다.
// 굴릴 수 있는 범위 끝에서는 브라우저가 알아서 멈춥니다. visibleTop·visibleBottom은 스크롤 상자에서 실제로 보이는 위아래 끝입니다
// (휴대폰 세로 문서는 위에 고정된 캔버스·되돌리기 줄 아래(scroll-padding-top), 데스크톱 카드는 카드 안쪽이 화면에 보이는 범위).
export const getTutorialCardScrollDelta = ({ placement, rect, tooltipHeight, visibleTop = 0, visibleBottom }: {
  placement: TutorialPlacement;
  rect: { top: number; height: number };
  tooltipHeight: number;
  visibleTop?: number;
  visibleBottom: number;
}): number => {
  if (placement === "above") return rect.top - getCardVisibleTop(tooltipHeight, visibleTop);
  if (rect.top < visibleTop) return rect.top - visibleTop - TUTORIAL_TOOLTIP_MARGIN;
  const bottom = rect.top + rect.height;
  if (bottom > visibleBottom) return Math.min(bottom - visibleBottom + TUTORIAL_TOOLTIP_MARGIN, rect.top - visibleTop - TUTORIAL_TOOLTIP_MARGIN);
  return 0;
};

// 휴대폰 세로에서 굴린 뒤 구획이 말풍선·고정 캔버스 아래, 툴바(visibleBottom) 위로 48px(구획이 더 낮으면 다) 보이는지.
// 아니면(낮은 창) 가려진 곳을 가리키지 않게 꼬리 없는 가운데 말풍선으로 설명합니다.
export const isTutorialCardTargetShown = ({ rect, visibleTop, tooltipHeight, visibleBottom }: {
  rect: { top: number; height: number };
  visibleTop: number;
  tooltipHeight: number;
  visibleBottom: number;
}): boolean => {
  const visibleHeight = Math.min(rect.top + rect.height, visibleBottom) - Math.max(rect.top, getCardVisibleTop(tooltipHeight, visibleTop));
  return visibleHeight >= Math.min(rect.height, TUTORIAL_CARD_MIN_VISIBLE);
};

// 시연 단계의 그림. 보이는 단계에서만 그려서 다른 단계와 건너뛴 손님은 받지 않습니다. 모든 단계의 크기가 같고
// 말풍선 내용 폭에 맞춰 고정해 그림이 늦게 오거나 단계를 넘겨도 말풍선이 흔들리지 않습니다.
// demoTooltipHeights는 시연 단계 말풍선(가운데 말풍선 포함)을 각각 그림 없이 잰 높이이고, 아직 재지 않았으면 null입니다.
// 그림을 넣을지는 그중 가장 높은 말풍선 하나로 정해 모든 시연 단계가 같이 보이거나 같이 숨습니다(단계마다 다르면 넘길 때
// 말풍선 높이가 크게 바뀜).
// bottomReserve는 화면 아래에 말풍선 말고 남겨야 할 높이입니다(휴대폰 세로 편집기: 툴바 + 툴바 위로 보일 카드 구획).
export const getTutorialDemoImage = ({ target, screen, prefersReducedMotion, demoTooltipHeights, viewportHeight, bottomReserve = 0 }: {
  target: TutorialTarget;
  screen: TutorialScreen;
  prefersReducedMotion: boolean;
  demoTooltipHeights: readonly number[] | null;
  viewportHeight: number;
  bottomReserve?: number;
}): TutorialDemoImage | null => {
  if (!isTutorialDemoTarget(target)) return null;
  // 낮은 가로는 말풍선이 이미 화면 높이를 거의 채워 그림을 넣으면 버튼을 가립니다.
  if (screen === "shortLandscape") return null;
  if (demoTooltipHeights === null || demoTooltipHeights.length === 0) return null;
  // 그림을 넣은 말풍선이 화면 안에 다 들어가지 않으면(낮은 데스크톱 창 등) [다음]·[건너뛰기]가 잘리므로 그리지 않습니다.
  const tallestHeightWithImage = Math.max(...demoTooltipHeights) + DEMO_IMAGE_BLOCK_HEIGHT;
  // 휴대폰 세로 편집기의 카드 단계는 말풍선 아래로 카드 구획이 툴바 위에 보여야 해서 그만큼 더 남깁니다.
  if (getLowestTooltipTop(tallestHeightWithImage, viewportHeight - bottomReserve) < TUTORIAL_TOOLTIP_MARGIN) return null;
  // 움직임 줄이기 설정이면 꾸민 뒤의 결과 장면 한 장만 보입니다.
  const src = prefersReducedMotion ? `/tutorial/${target}-demo-still.png` : `/tutorial/${target}-demo.webp`;
  return { src, width: DEMO_IMAGE_WIDTH, height: DEMO_IMAGE_HEIGHT };
};

// 말풍선은 단계를 넘길 때만 다음 자리로 0.25초 동안 옮겨 갑니다. 그림이 보이거나 숨는 때와 자리 종류가 바뀌는 때(레일 옆 ↔
// 가운데 ↔ 카드 옆)는 높이가 크게 바뀌고, 창 크기가 바뀌는 때는 옛 자리가 화면 밖일 수 있어, 움직이는 동안 버튼이 잘리지 않게
// 새 자리에 바로 놓습니다.
export const getTutorialTooltipTransition = ({ prefersReducedMotion, isStepChanged, isDemoImageToggled, isPlacementChanged }: {
  prefersReducedMotion: boolean;
  isStepChanged: boolean;
  isDemoImageToggled: boolean;
  isPlacementChanged: boolean;
}): string => (prefersReducedMotion || !isStepChanged || isDemoImageToggled || isPlacementChanged
  ? "none"
  : "top 0.25s cubic-bezier(0.4,0,0.2,1), left 0.25s cubic-bezier(0.4,0,0.2,1)");

const ARROW_CLAMP = 20; // 화살표가 말풍선 모서리에서 최소 이만큼 안쪽
const RAIL_TOOLTIP_LEFT = 85;

// 말풍선 자리(1.6 권장 3). 'above'는 대상 위(휴대폰 세로), 'left'는 대상 왼쪽(낮은 가로의 오른쪽 세로 툴바, 편집 카드),
// 'right'는 레일 오른쪽(데스크톱), 'center'는 꼬리 없이 화면 가운데(rect 없음). arrowOffset은 'above'에서 가로 px,
// 'left'·'right'는 세로 px, 'center'는 0입니다.
export const getTutorialTooltipLayout = ({ placement, rect, tooltipHeight, viewport }: {
  placement: TutorialPlacement;
  rect: { top: number; left: number; width: number; height: number } | null;
  tooltipHeight: number;
  viewport: { width: number; height: number };
}): TutorialTooltipLayout => {
  if (placement === "center" || rect === null) {
    return {
      top: Math.max(TUTORIAL_TOOLTIP_MARGIN, (viewport.height - tooltipHeight) / 2),
      left: Math.max(TUTORIAL_TOOLTIP_MARGIN, (viewport.width - TUTORIAL_TOOLTIP_WIDTH) / 2),
      arrowOffset: 0,
    };
  }
  if (placement === "above") {
    const top = Math.max(TUTORIAL_TOOLTIP_MARGIN, rect.top - tooltipHeight - TUTORIAL_TOOLTIP_MARGIN);
    const rawLeft = rect.left + rect.width / 2 - TUTORIAL_TOOLTIP_WIDTH / 2;
    const left = Math.max(TUTORIAL_TOOLTIP_MARGIN, Math.min(rawLeft, viewport.width - TUTORIAL_TOOLTIP_WIDTH - TUTORIAL_TOOLTIP_MARGIN));
    const buttonCenterX = rect.left + rect.width / 2;
    const arrowOffset = Math.max(ARROW_CLAMP, Math.min(buttonCenterX - left, TUTORIAL_TOOLTIP_WIDTH - ARROW_CLAMP));
    return { top, left, arrowOffset };
  }
  const centeredTop = rect.top + rect.height / 2 - tooltipHeight / 2;
  const top = Math.max(TUTORIAL_TOOLTIP_MARGIN, Math.min(centeredTop, getLowestTooltipTop(tooltipHeight, viewport.height)));
  const buttonCenterY = rect.top + rect.height / 2;
  const arrowOffset = Math.max(ARROW_CLAMP, Math.min(buttonCenterY - top, tooltipHeight - ARROW_CLAMP));
  const left = placement === "right"
    ? RAIL_TOOLTIP_LEFT
    : Math.max(TUTORIAL_TOOLTIP_MARGIN, rect.left - TUTORIAL_TOOLTIP_WIDTH - TUTORIAL_TOOLTIP_MARGIN);
  return { top, left, arrowOffset };
};

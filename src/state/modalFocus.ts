export type FocusMove = { kind: "stay" } | { kind: "move"; index: number } | { kind: "native" };
export type FocusCandidate = { isConnected: boolean; isDisabled: boolean; isInert: boolean; isHidden: boolean };

// 모달 안에서 Tab이 바깥으로 나가지 않게 다음 포커스 위치를 정합니다(설계 4.8).
export const getWrappedFocusIndex = ({
  focusableCount,
  activeIndex,
  isShiftKey,
}: {
  focusableCount: number;
  activeIndex: number;
  isShiftKey: boolean;
}): FocusMove => {
  if (focusableCount === 0) return { kind: "stay" };
  const lastIndex = focusableCount - 1;
  if (!isShiftKey && (activeIndex === lastIndex || activeIndex === -1)) return { kind: "move", index: 0 };
  if (isShiftKey && (activeIndex === 0 || activeIndex === -1)) return { kind: "move", index: lastIndex };
  return { kind: "native" };
};

// 닫힌 뒤 포커스를 돌려줄 첫 후보의 위치. 없으면 -1
export const pickFocusReturnIndex = (candidates: FocusCandidate[]): number => candidates.findIndex(
  (candidate) => candidate.isConnected && !candidate.isDisabled && !candidate.isInert && !candidate.isHidden,
);

// 안내가 어디서 시작했는지. 저장 요청에서 시작했으면 "save", 프레임 바꾸기 확인창에서 시작했으면 "frame-change"
export type FocusReturnOrigin = "save" | "frame-change";

// 닫힌 뒤 포커스를 돌려줄 후보를 우선순위대로 늘어놓습니다. 시트가 아직 열려 있으면 그 안 후보를
// 캔버스·저장 버튼보다 앞에 둬서 포커스가 시트 뒤로 가지 않게 합니다(UX1-1). 시트가 닫혔으면 sheetCandidates는 비어 있습니다.
// 저장에서 시작했으면 원래 버튼을 못 쓸 때(화면 폭이 바뀐 경우 등) 지금 배치의 저장 버튼이 캔버스보다 앞입니다(UX2-2).
export const getFocusReturnCandidates = <Candidate>({
  origin,
  opener,
  sheetCandidates,
  canvas,
  saves,
}: {
  origin: FocusReturnOrigin;
  opener: Candidate | null;
  sheetCandidates: Candidate[];
  canvas: Candidate | null;
  saves: Candidate[];
}): (Candidate | null)[] => origin === "save"
  ? [opener, ...sheetCandidates, ...saves, canvas]
  : [opener, ...sheetCandidates, canvas, ...saves];

// 저장이 끝난 뒤 배치가 바뀌어 눌러 둔 저장 버튼이 사라졌을 때, 지금 배치의 저장 버튼으로 다시 돌려줄지 정합니다(UX5-5).
// 복귀 요청이 남아 있고 활성 요소가 body이거나 문서에서 사라졌을 때만 돌려주고, 다른 곳에 있는 포커스는 뺏지 않습니다.
export const shouldRefocusAfterLayoutChange = ({
  isPending,
  activeElement,
}: {
  isPending: boolean;
  activeElement: { isBody: boolean; isConnected: boolean } | null;
}): boolean => isPending && (activeElement === null || activeElement.isBody || !activeElement.isConnected);

// 포커스를 돌려줄 요소가 화면 높이 안에 모두 들어와 있는지 봅니다(UX6-2). 보이면 스크롤하지 않고 포커스를 줍니다.
// 보이는 버튼에 focus()를 하면 브라우저가 문서 아래 스크롤 여백(툴바 높이)만큼 문서를 밀기 때문입니다.
// 소수점 반올림으로 생기는 1px 안쪽 차이는 화면 안으로 봅니다.
const VIEWPORT_ROUNDING_TOLERANCE_PX = 1;
export const isRectInViewport = ({
  rect,
  viewportHeight,
}: {
  rect: { top: number; bottom: number };
  viewportHeight: number;
}): boolean => rect.top >= -VIEWPORT_ROUNDING_TOLERANCE_PX && rect.bottom <= viewportHeight + VIEWPORT_ROUNDING_TOLERANCE_PX;

export type TextDeleteFocusTarget = "undo" | "text-input" | "none";

// '글씨 지우기'를 누른 뒤 포커스를 보낼 곳을 정합니다. 지운 글씨가 선택에서 빠지면 눌렀던 버튼이 잠겨 포커스가 body로 사라집니다.
// 키보드로 눌렀을 때만 옮깁니다(UX5-7과 같은 규칙. 마우스·터치에서는 휴대폰 키보드가 올라오지 않게 옮기지 않음).
// 그 자리에 새로 나타난 '되돌리기'가 있으면 거기로, 없으면 글씨 입력 칸으로 갑니다.
export const getTextDeleteFocusTarget = ({
  isKeyboardFocused,
  hasUndoButton,
}: {
  isKeyboardFocused: boolean;
  hasUndoButton: boolean;
}): TextDeleteFocusTarget => {
  if (!isKeyboardFocused) return "none";
  return hasUndoButton ? "undo" : "text-input";
};

export type PickFocusTarget = "first-frame-card" | "canvas" | "none";

// 처음 화면에서 컷 수 버튼이나 프레임 카드를 누르면 누른 버튼이 다른 화면으로 바뀌며 사라져 포커스가 body가 됩니다(A7-04).
// 키보드로 눌렀을 때만 다음 화면의 시작점으로 옮깁니다(UX5-7·UX6-3과 같은 규칙. 마우스·터치는 그대로 둠).
// 컷 수 버튼 → 첫 프레임 카드, 프레임 카드 → 캔버스.
export const getPickFocusTarget = ({
  pressed,
  isKeyboardFocused,
}: {
  pressed: "cut-count" | "frame-card";
  isKeyboardFocused: boolean;
}): PickFocusTarget => {
  if (!isKeyboardFocused) return "none";
  return pressed === "cut-count" ? "first-frame-card" : "canvas";
};

type InertTarget = { inert: boolean };
const isInertTarget = (element: object): element is InertTarget => "inert" in element;

// container의 직계 자식 가운데 keep에 없고 아직 inert가 아닌 것에 inert를 겁니다. 돌려주는 함수는 자기가 건 것만 풉니다.
// 받은 요소의 inert만 바꾸고 DOM 전역(document, window, HTMLElement)을 읽지 않습니다(0.2 순수 모듈 규칙).
export const setInertOutside = ({
  container,
  keep,
}: {
  container: { children: ArrayLike<object> };
  keep: (object | null)[];
}): (() => void) => {
  const lockedElements = Array.from(container.children).filter(
    (element): element is InertTarget => isInertTarget(element) && !keep.includes(element) && !element.inert,
  );
  lockedElements.forEach((element) => { element.inert = true; });
  return () => { lockedElements.forEach((element) => { element.inert = false; }); };
};

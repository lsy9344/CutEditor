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

// 안내가 어디서 시작했는지. 저장 요청은 "save", 프레임 바꾸기 확인창은 "frame-change", '이 스티커만 저장'은 "sticker-save"
export type FocusReturnOrigin = "save" | "frame-change" | "sticker-save";

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

// 배치가 휴대폰에서 데스크톱으로 바뀌었는데 휴대폰 시트가 열려 있으면 시트 상태를 닫을지 정합니다(UX8-1).
// 데스크톱 배치에는 시트가 없어서, 상태를 남기면 창을 다시 좁힐 때 시트가 저절로 다시 열립니다.
export const shouldCloseMobileSheet = ({
  wasMobileEditor,
  isMobileEditor,
  isSheetOpen,
}: {
  wasMobileEditor: boolean;
  isMobileEditor: boolean;
  isSheetOpen: boolean;
}): boolean => isSheetOpen && wasMobileEditor && !isMobileEditor;

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

export type EraseModeFocusTarget = "erase-done" | "erase-start" | "none";

// 지우기 모드에 들어가고 나올 때 포커스를 옮길 곳(설계 8.3). 키보드로 눌렀을 때만 옮깁니다.
export const getEraseModeFocusTarget = ({
  change,
  isKeyboardFocused,
}: {
  change: "enter" | "exit";
  isKeyboardFocused: boolean;
}): EraseModeFocusTarget => {
  if (!isKeyboardFocused) return "none";
  return change === "enter" ? "erase-done" : "erase-start";
};

type InertTarget = { inert: boolean };
const isInertTarget = (element: object): element is InertTarget => "inert" in element;

// 요소마다 지금 잠근 호출 수와 처음 잠기기 전의 inert 값을 기억합니다(UX7-1). 시트·공유 화면·누끼 잠금이 겹쳐도
// 먼저 건 쪽이 먼저 풀려 배경이 열리지 않고, 마지막 잠금이 풀릴 때만 처음 값으로 돌아갑니다.
const inertLocks = new WeakMap<object, { lockCount: number; initialInert: boolean }>();

// container의 직계 자식 가운데 keep에 없는 것에 inert를 겁니다. 돌려주는 함수는 자기 호출분만 하나 줄이고, 두 번 불러도 한 번만 셉니다.
// 받은 요소의 inert만 바꾸고 DOM 전역(document, window, HTMLElement)을 읽지 않습니다(0.2 순수 모듈 규칙).
export const setInertOutside = ({
  container,
  keep,
}: {
  container: { children: ArrayLike<object> };
  keep: (object | null)[];
}): (() => void) => {
  const lockedElements = Array.from(container.children).filter(
    (element): element is InertTarget => isInertTarget(element) && !keep.includes(element),
  );
  lockedElements.forEach((element) => {
    const lock = inertLocks.get(element) ?? { lockCount: 0, initialInert: element.inert };
    lock.lockCount += 1;
    inertLocks.set(element, lock);
    element.inert = true;
  });
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    lockedElements.forEach((element) => {
      const lock = inertLocks.get(element);
      if (!lock) return;
      lock.lockCount -= 1;
      if (lock.lockCount > 0) return;
      inertLocks.delete(element);
      element.inert = lock.initialInert;
    });
  };
};

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

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

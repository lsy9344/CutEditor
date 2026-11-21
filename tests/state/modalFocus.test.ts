import test from "node:test";
import assert from "node:assert/strict";

import { getFocusReturnCandidates, getTextDeleteFocusTarget, getWrappedFocusIndex, pickFocusReturnIndex, shouldRefocusAfterLayoutChange } from "../../src/state/modalFocus.ts";
import type { FocusCandidate } from "../../src/state/modalFocus.ts";

const NORMAL_CANDIDATE: FocusCandidate = { isConnected: true, isDisabled: false, isInert: false, isHidden: false };
const DISCONNECTED_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isConnected: false };
const DISABLED_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isDisabled: true };
const INERT_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isInert: true };
const HIDDEN_CANDIDATE: FocusCandidate = { ...NORMAL_CANDIDATE, isHidden: true };

test("포커스할 곳이 하나도 없으면 Tab도 Shift+Tab도 제자리에 둔다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 0, activeIndex: -1, isShiftKey: false }), { kind: "stay" });
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 0, activeIndex: -1, isShiftKey: true }), { kind: "stay" });
});

test("마지막 버튼에서 Tab을 누르면 처음 버튼으로 돌아간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 2, isShiftKey: false }), {
    kind: "move",
    index: 0,
  });
});

test("대화상자 카드에 포커스가 있을 때 Tab을 누르면 처음 버튼으로 간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: -1, isShiftKey: false }), {
    kind: "move",
    index: 0,
  });
});

test("처음 버튼에서 Tab을 누르면 브라우저 기본 이동에 맡긴다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 0, isShiftKey: false }), { kind: "native" });
});

test("처음 버튼에서 Shift+Tab을 누르면 마지막 버튼으로 돌아간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 0, isShiftKey: true }), {
    kind: "move",
    index: 2,
  });
});

test("대화상자 카드에 포커스가 있을 때 Shift+Tab을 누르면 마지막 버튼으로 간다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: -1, isShiftKey: true }), {
    kind: "move",
    index: 2,
  });
});

test("마지막 버튼에서 Shift+Tab을 누르면 브라우저 기본 이동에 맡긴다", () => {
  assert.deepEqual(getWrappedFocusIndex({ focusableCount: 3, activeIndex: 2, isShiftKey: true }), { kind: "native" });
});

test("포커스를 돌려줄 후보는 끊김·잠김·inert·숨김을 건너뛰고 첫 정상 후보를 고른다", () => {
  const candidates = [
    DISCONNECTED_CANDIDATE,
    DISABLED_CANDIDATE,
    INERT_CANDIDATE,
    HIDDEN_CANDIDATE,
    NORMAL_CANDIDATE,
    NORMAL_CANDIDATE,
  ];

  assert.equal(pickFocusReturnIndex(candidates), 4);
});

test("쓸 수 있는 후보가 없거나 후보가 빈 배열이면 -1을 돌려준다", () => {
  const unusableCandidates = [DISCONNECTED_CANDIDATE, DISABLED_CANDIDATE, INERT_CANDIDATE, HIDDEN_CANDIDATE];

  assert.equal(pickFocusReturnIndex(unusableCandidates), -1);
  assert.equal(pickFocusReturnIndex([]), -1);
});

// UX1-1: 프레임 시트가 아직 열려 있으면 포커스는 시트 안에 둡니다. 시트 후보는 캔버스·저장 버튼보다 앞입니다.
test("돌려줄 후보는 연 곳, 열린 시트 안 후보, 캔버스, 저장 버튼 순서다", () => {
  assert.deepEqual(
    getFocusReturnCandidates({ origin: "frame-change", opener: "opener", sheetCandidates: ["sheet-close"], canvas: "canvas", saves: ["save-1", "save-2"] }),
    ["opener", "sheet-close", "canvas", "save-1", "save-2"],
  );
});

test("시트가 없으면 돌려줄 후보는 전과 같이 연 곳, 캔버스, 저장 버튼 순서다", () => {
  assert.deepEqual(
    getFocusReturnCandidates({ origin: "frame-change", opener: null, sheetCandidates: [], canvas: "canvas", saves: ["save"] }),
    [null, "canvas", "save"],
  );
});

test("연 곳을 못 쓰면 열린 시트의 닫기 버튼이 캔버스와 저장 버튼보다 먼저 고른다", () => {
  const described = [DISCONNECTED_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE];

  assert.equal(pickFocusReturnIndex(described), 1);
});

test("시트가 닫혀 닫기 버튼이 문서에 없으면 캔버스로 돌아간다", () => {
  const described = [DISCONNECTED_CANDIDATE, DISCONNECTED_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE];

  assert.equal(pickFocusReturnIndex(described), 2);
});

test("연 곳을 쓸 수 있으면 열린 시트가 있어도 연 곳이 먼저다", () => {
  const described = [NORMAL_CANDIDATE, NORMAL_CANDIDATE, NORMAL_CANDIDATE];

  assert.equal(pickFocusReturnIndex(described), 0);
});

// UX2-2: 저장에서 시작한 안내는 원래 저장 버튼을 못 쓰면 지금 배치의 저장 버튼으로 돌아간다. 캔버스보다 앞이다.
test("저장에서 시작한 안내는 연 곳, 열린 시트 안 후보, 저장 버튼, 캔버스 순서로 돌려준다", () => {
  assert.deepEqual(
    getFocusReturnCandidates({ origin: "save", opener: "opener", sheetCandidates: ["sheet-close"], canvas: "canvas", saves: ["save-1", "save-2"] }),
    ["opener", "sheet-close", "save-1", "save-2", "canvas"],
  );
});

test("저장에서 시작했고 원래 저장 버튼이 사라졌으면 지금 배치의 저장 버튼이 캔버스보다 먼저 고른다", () => {
  const candidates = getFocusReturnCandidates({ origin: "save", opener: "old-save", sheetCandidates: [], canvas: "canvas", saves: ["phone-save"] });
  const described = candidates.map((candidate) => (candidate === "old-save" ? DISCONNECTED_CANDIDATE : NORMAL_CANDIDATE));

  assert.equal(candidates[pickFocusReturnIndex(described)], "phone-save");
});

test("저장에서 시작했어도 저장 버튼을 모두 못 쓰면 캔버스로 돌아간다", () => {
  const candidates = getFocusReturnCandidates({ origin: "save", opener: null, sheetCandidates: [], canvas: "canvas", saves: ["hidden-save"] });
  const described = candidates.map((candidate) => (candidate === "canvas" ? NORMAL_CANDIDATE : DISCONNECTED_CANDIDATE));

  assert.equal(candidates[pickFocusReturnIndex(described)], "canvas");
});

test("프레임 바꾸기에서 시작한 안내는 연 곳을 못 쓰면 저장 버튼이 있어도 캔버스로 돌아간다", () => {
  const candidates = getFocusReturnCandidates({ origin: "frame-change", opener: "frame-card", sheetCandidates: [], canvas: "canvas", saves: ["save"] });
  const described = candidates.map((candidate) => (candidate === "frame-card" ? DISCONNECTED_CANDIDATE : NORMAL_CANDIDATE));

  assert.equal(candidates[pickFocusReturnIndex(described)], "canvas");
});

// UX5-5: 저장이 끝난 뒤 배치가 바뀌어 포커스가 사라졌을 때만 지금 배치의 저장 버튼으로 돌려줍니다.
test("저장에서 온 복귀 요청이 남아 있고 활성 요소가 body이면 배치가 바뀐 뒤 다시 돌려준다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: { isBody: true, isConnected: true } }), true);
});

test("저장에서 온 복귀 요청이 남아 있고 활성 요소가 사라졌으면 다시 돌려준다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: { isBody: false, isConnected: false } }), true);
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: null }), true);
});

test("활성 요소가 문서에 남아 있는 다른 요소이면 포커스를 뺏지 않는다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: true, activeElement: { isBody: false, isConnected: true } }), false);
});

test("복귀 요청이 없으면 활성 요소가 body여도 돌려주지 않는다", () => {
  assert.equal(shouldRefocusAfterLayoutChange({ isPending: false, activeElement: { isBody: true, isConnected: true } }), false);
});

// 글씨 지우기: 키보드로 눌렀을 때만 포커스를 옮깁니다. 지운 글씨가 선택에서 빠져 눌렀던 버튼이 잠기기 때문입니다.
test("글씨 지우기를 키보드로 누르면 되돌리기로, 그 버튼이 없으면 글씨 입력 칸으로 가고 마우스·터치로 누르면 옮기지 않는다", () => {
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: true, hasUndoButton: true }), "undo");
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: true, hasUndoButton: false }), "text-input");
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: false, hasUndoButton: true }), "none");
  assert.equal(getTextDeleteFocusTarget({ isKeyboardFocused: false, hasUndoButton: false }), "none");
});

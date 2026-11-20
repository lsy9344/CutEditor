import test from "node:test";
import assert from "node:assert/strict";

import { getFocusReturnCandidates, getWrappedFocusIndex, pickFocusReturnIndex } from "../../src/state/modalFocus.ts";
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
    getFocusReturnCandidates({ opener: "opener", sheetCandidates: ["sheet-close"], canvas: "canvas", saves: ["save-1", "save-2"] }),
    ["opener", "sheet-close", "canvas", "save-1", "save-2"],
  );
});

test("시트가 없으면 돌려줄 후보는 전과 같이 연 곳, 캔버스, 저장 버튼 순서다", () => {
  assert.deepEqual(
    getFocusReturnCandidates({ opener: null, sheetCandidates: [], canvas: "canvas", saves: ["save"] }),
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

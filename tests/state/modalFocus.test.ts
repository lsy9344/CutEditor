import test from "node:test";
import assert from "node:assert/strict";

import { getWrappedFocusIndex, pickFocusReturnIndex } from "../../src/state/modalFocus.ts";
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

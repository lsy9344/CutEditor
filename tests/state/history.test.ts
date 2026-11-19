import test from "node:test";
import assert from "node:assert/strict";

import {
  HISTORY_CAPTURE_DELAY_MS,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createHistory,
  getHistoryShortcut,
  pushHistory,
  redoHistory,
  undoHistory,
} from "../../src/state/history.ts";
import type { HistoryShortcutInput } from "../../src/state/history.ts";

const isSame = (a: number, b: number) => a === b;

function makeShortcutInput(overrides: Partial<HistoryShortcutInput>): HistoryShortcutInput {
  return {
    key: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isEditableTarget: false,
    ...overrides,
  };
}

test("createHistory는 빈 과거·현재·미래 기록을 만든다", () => {
  const history = createHistory(1);

  assert.deepEqual(history, { past: [], present: 1, future: [] });
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
});

test("pushHistory는 현재 값을 과거에 쌓고 새 값을 현재로 둔다", () => {
  const firstPush = pushHistory(createHistory(1), 2, isSame);
  const secondPush = pushHistory(firstPush, 3, isSame);

  assert.deepEqual(secondPush, { past: [1, 2], present: 3, future: [] });
});

test("pushHistory는 같은 문서를 두 번 기록하지 않고 입력 객체를 그대로 돌려준다", () => {
  const firstPush = pushHistory(createHistory(1), 2, isSame);
  const secondPush = pushHistory(firstPush, 3, isSame);

  const result = pushHistory(secondPush, 3, isSame);

  assert.equal(result, secondPush);
});

test("undoHistory는 단계마다 하나씩 되돌리고, 더 되돌릴 것이 없으면 같은 객체를 돌려준다", () => {
  const firstPush = pushHistory(createHistory(1), 2, isSame);
  const secondPush = pushHistory(firstPush, 3, isSame);

  const firstUndo = undoHistory(secondPush);
  const secondUndo = undoHistory(firstUndo);

  assert.equal(secondUndo.present, 1);
  assert.deepEqual(secondUndo.future, [2, 3]);
  assert.equal(undoHistory(secondUndo), secondUndo);
});

test("redoHistory는 되돌린 단계를 다시 적용한다", () => {
  const firstPush = pushHistory(createHistory(1), 2, isSame);
  const secondPush = pushHistory(firstPush, 3, isSame);
  const undone = undoHistory(undoHistory(secondPush));

  const redone = redoHistory(undone);

  assert.deepEqual(redone, { past: [1], present: 2, future: [3] });
});

test("pushHistory는 새 값을 기록하면 미래 기록을 버린다", () => {
  const history = { past: [1], present: 2, future: [3] };

  assert.deepEqual(pushHistory(history, 4, isSame), { past: [1, 2], present: 4, future: [] });
});

test("pushHistory는 limit을 넘은 과거 기록을 오래된 것부터 버린다", () => {
  let history = createHistory(0);

  for (const value of [1, 2, 3, 4, 5]) {
    history = pushHistory(history, value, isSame, 3);
  }

  assert.deepEqual(history, { past: [2, 3, 4], present: 5, future: [] });
});

test("기록 상수는 최대 50단계와 400ms 묶음 지연을 쓴다", () => {
  assert.equal(HISTORY_LIMIT, 50);
  assert.equal(HISTORY_CAPTURE_DELAY_MS, 400);
});

test("getHistoryShortcut은 Ctrl+Z를 되돌리기로 읽는다", () => {
  assert.equal(getHistoryShortcut(makeShortcutInput({ key: "z", ctrlKey: true })), "undo");
});

test("getHistoryShortcut은 Ctrl+Shift+Z를 대문자 키에서도 다시 하기로 읽는다", () => {
  assert.equal(getHistoryShortcut(makeShortcutInput({ key: "Z", ctrlKey: true, shiftKey: true })), "redo");
});

test("getHistoryShortcut은 Cmd+Shift+Z를 다시 하기로 읽는다", () => {
  assert.equal(getHistoryShortcut(makeShortcutInput({ key: "z", metaKey: true, shiftKey: true })), "redo");
});

test("getHistoryShortcut은 Ctrl+Y를 다시 하기로 읽는다", () => {
  assert.equal(getHistoryShortcut(makeShortcutInput({ key: "y", ctrlKey: true })), "redo");
});

test("getHistoryShortcut은 Cmd+Y를 무시한다", () => {
  assert.equal(getHistoryShortcut(makeShortcutInput({ key: "y", metaKey: true })), null);
});

test("getHistoryShortcut은 보조키 없는 Z를 무시한다", () => {
  assert.equal(getHistoryShortcut(makeShortcutInput({ key: "z" })), null);
});

test("getHistoryShortcut은 입력 칸에 초점이 있으면 무시한다", () => {
  assert.equal(
    getHistoryShortcut(makeShortcutInput({ key: "z", ctrlKey: true, isEditableTarget: true })),
    null,
  );
});

import test from "node:test";
import assert from "node:assert/strict";

import { canUndoTextDelete, isSameEditorDocument } from "../../src/state/editorDocument.ts";
import type { CanvasText, EditorDocument, TextDeleteRecord } from "../../src/state/editorDocument.ts";
import { createHistory, pushHistory, undoHistory } from "../../src/state/history.ts";

function makeText(id: string): CanvasText {
  return {
    id,
    text: "테스트",
    x: 10,
    y: 20,
    boxWidth: 100,
    fontSize: 24,
    fontFamily: "NanumSquare",
    fontColor: "#000000",
    isBold: false,
    isItalic: false,
    isVertical: false,
    textAlign: "left",
    rotation: 0,
  };
}

function makeTextDeleteCase() {
  const before: EditorDocument = { userImages: [], texts: [makeText("t1")], stickers: [], frameColor: "#FFFFFF" };
  const deleted: EditorDocument = { ...before, texts: [] };
  const history = createHistory(before);
  // App의 handleTextDelete가 만드는 기록: base는 지우기 직전 기록 맨 위 문서 객체입니다.
  const record: TextDeleteRecord = {
    base: pushHistory(history, before, isSameEditorDocument).present,
    deleted,
  };
  return { before, deleted, history, record };
}

test("글씨를 지우고 바로 되돌리면 지운 글씨가 돌아온다", () => {
  const { before, deleted, history, record } = makeTextDeleteCase();
  assert.equal(record.base, before);

  // 지우기가 아직 기록되기 전에도 안내가 보인다
  assert.equal(canUndoTextDelete({ record, history, currentDocument: deleted }), true);

  // 지우기가 기록된 뒤에도 안내가 보인다
  const recordedHistory = pushHistory(history, deleted, isSameEditorDocument);
  assert.equal(canUndoTextDelete({ record, history: recordedHistory, currentDocument: deleted }), true);

  // App의 handleUndo처럼 되돌리면 글씨 t1이 돌아온다
  const undone = undoHistory(pushHistory(history, deleted, isSameEditorDocument));
  assert.ok(isSameEditorDocument(undone.present, before));
  assert.deepEqual(
    undone.present.texts.map((text) => text.id),
    ["t1"],
  );
});

test("글씨를 지운 뒤 프레임 색을 바꾸면 안내가 사라지고 색 변경은 그대로 남는다", () => {
  const { before, deleted, record } = makeTextDeleteCase();
  const history = pushHistory(createHistory(before), deleted, isSameEditorDocument);
  // 지우기가 기록 맨 위일 때는 안내가 보인다(색을 바꾸기 전)
  assert.equal(canUndoTextDelete({ record, history, currentDocument: deleted }), true);
  const colored: EditorDocument = { ...deleted, frameColor: "#000000" };

  // 맨 위 기록이 지우기가 아니므로 안내가 사라진다
  assert.equal(canUndoTextDelete({ record, history, currentDocument: colored }), false);
  // App effect가 기록을 비운 뒤에도 안내가 없다
  assert.equal(canUndoTextDelete({ record: null, history, currentDocument: deleted }), false);

  // 안내가 없으니 되돌리기를 부르지 않고 색이 그대로 남는다
  assert.equal(colored.frameColor, "#000000");

  // 일반 되돌리기는 색만 되돌리고 글씨를 다시 만들지 않는다
  const undone = undoHistory(pushHistory(history, colored, isSameEditorDocument));
  assert.ok(isSameEditorDocument(undone.present, deleted));
  assert.equal(undone.present.texts.length, 0);
});

test("글씨를 지운 뒤 같은 칸 수의 프레임으로 바꾸면 문서 값이 같아도 안내가 사라진다", () => {
  const { deleted, record } = makeTextDeleteCase();
  // App의 applyFrameChange처럼 기록을 초기화합니다(문서 값은 그대로).
  const frameChanged = createHistory({ ...deleted });

  assert.equal(isSameEditorDocument(frameChanged.present, record.deleted), true);
  assert.equal(
    canUndoTextDelete({ record, history: frameChanged, currentDocument: frameChanged.present }),
    false,
  );
});

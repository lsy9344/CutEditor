import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyLoadedFontBoxWidths, resolveFontAwareTextBoxWidth } from "../../src/canvas/textBoxWidth.ts";
import {
  canUndoTextDelete,
  createDocumentTextsMapper,
  isSameEditorDocument,
  mapTextDeleteRecord,
} from "../../src/state/editorDocument.ts";
import type { CanvasText, EditorDocument, TextDeleteRecord } from "../../src/state/editorDocument.ts";
import { createHistory, mapHistory, pushHistory, redoHistory, undoHistory } from "../../src/state/history.ts";
import type { History } from "../../src/state/history.ts";

// 느린 글꼴: 대체 글꼴로 잰 최소 폭 598, 받은 뒤 실제 글꼴로 잰 최소 폭 589(Codex 검토 재현값).
const FALLBACK_MINIMUM_WIDTH = 598;
const LOADED_MINIMUM_WIDTH = 589;

const emptyDocument: EditorDocument = { userImages: [], texts: [], stickers: [], frameColor: "#FFFFFF" };

function insertTextBeforeFontLoad(document: EditorDocument): EditorDocument {
  const widths = resolveFontAwareTextBoxWidth({
    previousBoxWidth: 0,
    hasExplicitBoxWidth: false,
    minimumBoxWidth: FALLBACK_MINIMUM_WIDTH,
    didOrientationChange: false,
    isFontReady: false,
  });
  const text: CanvasText = {
    id: "text-1",
    text: "글씨",
    x: 10,
    y: 20,
    fontSize: 16,
    fontFamily: "Aritaburi",
    fontColor: "#000000",
    isBold: false,
    isItalic: false,
    isVertical: false,
    textAlign: "center",
    rotation: 0,
    ...widths,
  };
  return { ...document, texts: [...document.texts, text] };
}

// App의 loadTextFonts가 글꼴 도착 뒤 하는 일: 지금 글씨와 기록 속 문서에 같은 재측정을 적용합니다.
function arriveFont(state: { history: History<EditorDocument>; current: EditorDocument }) {
  const remeasureTexts = (texts: CanvasText[]) => applyLoadedFontBoxWidths(texts, {
    isFontReady: () => true,
    getMinimumBoxWidth: () => LOADED_MINIMUM_WIDTH,
  });
  const remeasureDocument = createDocumentTextsMapper(remeasureTexts);
  return {
    history: mapHistory(state.history, remeasureDocument),
    current: { ...state.current, texts: remeasureTexts(state.current.texts) },
    remeasureDocument,
  };
}

// App의 handleUndo·handleRedo처럼 지금 문서를 먼저 기록에 넣고 한 단계 옮깁니다.
const undo = (history: History<EditorDocument>, current: EditorDocument) => undoHistory(pushHistory(history, current, isSameEditorDocument));
const redo = (history: History<EditorDocument>, current: EditorDocument) => redoHistory(pushHistory(history, current, isSameEditorDocument));

test("느린 글꼴: 글씨 추가가 기록된 뒤 글꼴이 와도 되돌리기 한 번에 글씨가 사라지고 다시하기 한 번에 돌아온다", () => {
  const inserted = insertTextBeforeFontLoad(emptyDocument);
  assert.equal(inserted.texts[0].boxWidth, FALLBACK_MINIMUM_WIDTH);
  // 400ms 기록 수집이 글씨 추가를 한 단계로 닫습니다.
  const recorded = pushHistory(createHistory(emptyDocument), inserted, isSameEditorDocument);

  const afterFont = arriveFont({ history: recorded, current: inserted });
  assert.equal(afterFont.current.texts[0].boxWidth, LOADED_MINIMUM_WIDTH);
  assert.equal(afterFont.current.texts[0].boxWidthBeforeFontLoad, undefined);
  // 재측정 뒤 기록 수집이 다시 돌아도 새 단계가 생기지 않습니다.
  const afterCapture = pushHistory(afterFont.history, afterFont.current, isSameEditorDocument);
  assert.equal(afterCapture, afterFont.history);
  assert.equal(afterCapture.past.length, 1);

  const undone = undo(afterCapture, afterFont.current);
  assert.deepEqual(undone.present.texts, [], "되돌리기 한 번에 글씨가 사라져야 합니다");
  assert.equal(undone.past.length, 0);

  const redone = redo(undone, undone.present);
  assert.equal(redone.present.texts.length, 1, "다시하기 한 번에 글씨가 돌아와야 합니다");
  assert.equal(redone.present.texts[0].boxWidth, LOADED_MINIMUM_WIDTH, "돌아온 글씨는 실제 글꼴 폭이어야 합니다");
  assert.ok(isSameEditorDocument(redone.present, afterFont.current));
  assert.equal(redone.future.length, 0);
});

test("느린 글꼴: 글씨 추가가 기록되기 전에 글꼴이 와도 한 단계로 남는다", () => {
  const inserted = insertTextBeforeFontLoad(emptyDocument);
  const history = createHistory(emptyDocument);

  const afterFont = arriveFont({ history, current: inserted });
  const afterCapture = pushHistory(afterFont.history, afterFont.current, isSameEditorDocument);
  assert.equal(afterCapture.past.length, 1);

  const undone = undo(afterCapture, afterFont.current);
  assert.deepEqual(undone.present.texts, []);
  assert.equal(undone.past.length, 0);
});

test("느린 글꼴: 글씨 추가를 되돌린 뒤 글꼴이 와도 다시하기 한 번에 실제 글꼴 폭으로 돌아온다", () => {
  const inserted = insertTextBeforeFontLoad(emptyDocument);
  const recorded = pushHistory(createHistory(emptyDocument), inserted, isSameEditorDocument);
  const undone = undo(recorded, inserted);

  const afterFont = arriveFont({ history: undone, current: undone.present });
  assert.equal(afterFont.history.future[0].texts[0].boxWidth, LOADED_MINIMUM_WIDTH);

  const redone = redo(afterFont.history, afterFont.current);
  assert.equal(redone.present.texts[0].boxWidth, LOADED_MINIMUM_WIDTH);
  assert.equal(redone.present.texts[0].boxWidthBeforeFontLoad, undefined);
});

test("재측정할 글씨가 없으면 기록·문서 객체를 그대로 둔다", () => {
  const history = pushHistory(createHistory(emptyDocument), { ...emptyDocument, frameColor: "#000000" }, isSameEditorDocument);
  const { history: mappedHistory, remeasureDocument } = arriveFont({ history, current: history.present });

  assert.equal(mappedHistory, history);
  assert.equal(remeasureDocument(emptyDocument), emptyDocument);
});

test("글꼴 재측정은 글씨 지우기 기록도 같은 객체로 바꿔, 지우기 안내의 [되돌리기]가 계속 맞다", () => {
  const inserted = insertTextBeforeFontLoad(emptyDocument);
  const recorded = pushHistory(createHistory(emptyDocument), inserted, isSameEditorDocument);
  // App의 handleTextDelete처럼 지우기 직전 기록 맨 위 문서 객체를 base로 둡니다.
  const record: TextDeleteRecord = {
    base: pushHistory(recorded, inserted, isSameEditorDocument).present,
    deleted: { ...inserted, texts: [] },
  };
  const deletedCurrent = record.deleted;
  assert.equal(canUndoTextDelete({ record, history: recorded, currentDocument: deletedCurrent }), true);

  const afterFont = arriveFont({ history: recorded, current: deletedCurrent });
  const mappedRecord = mapTextDeleteRecord(record, afterFont.remeasureDocument);
  assert.notEqual(mappedRecord, record);
  assert.equal(canUndoTextDelete({ record: mappedRecord, history: afterFont.history, currentDocument: afterFont.current }), true);
  assert.equal(mapTextDeleteRecord(null, afterFont.remeasureDocument), null);
});

test("App은 글꼴 도착 재측정을 지금 글씨·편집 기록·글씨 지우기 기록에 함께 적용한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  const start = source.indexOf("const loadTextFonts = useCallback(");
  const end = source.indexOf("const loadTextFontsForSave", start);
  const loadSource = source.slice(start, end);

  assert.match(loadSource, /const remeasureDocument = createDocumentTextsMapper\(remeasureTexts\);/);
  assert.match(loadSource, /setTexts\(remeasureTexts\);/);
  assert.match(loadSource, /setHistory\(prev => mapHistory\(prev, remeasureDocument\)\);/);
  assert.match(loadSource, /setTextDeleteRecord\(prev => mapTextDeleteRecord\(prev, remeasureDocument\)\);/);
});

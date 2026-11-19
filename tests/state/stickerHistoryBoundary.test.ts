import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createHistory,
  pushHistory,
  undoHistory,
} from "../../src/state/history.ts";

const isSame = (a: string, b: string) => a === b;

test("스티커 삽입 직전 기록 경계가 앞선 색 변경과 삽입을 한 단계씩 나눈다", () => {
  let history = createHistory("base");
  let current = "color";

  history = pushHistory(history, current, isSame); // 삽입 직전 flushHistory()
  current = "color+sticker";

  history = undoHistory(pushHistory(history, current, isSame)); // 첫 되돌리기
  assert.equal(history.present, "color");
  current = history.present;

  history = undoHistory(pushHistory(history, current, isSame)); // 두 번째 되돌리기
  assert.equal(history.present, "base");
});

test("삽입 직전 경계가 없으면 한 번의 되돌리기에 색 변경까지 함께 사라진다", () => {
  let history = createHistory("base");
  const current = "color+sticker";

  history = undoHistory(pushHistory(history, current, isSame));

  assert.equal(history.present, "base");
});

test("App은 스티커 삽입 직전에 flushHistory를 호출하고 함수형 갱신으로 붙인다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /flushHistory\(\);\s*setStickers\(\(previous\) => \[\.\.\.previous, newSticker\]\);/,
  );
  assert.doesNotMatch(source, /pushSeparateStep/);
});

test("끌기 중 완료된 스티커는 끌기 종료 뒤 붙어 첫 되돌리기는 둘째만, 두 번째는 첫째를 시작 위치로 되돌린다", () => {
  let history = createHistory("base");
  let current = "base";
  const held: string[] = [];

  // 첫째 스티커를 끄는 동안 둘째 스티커의 치수 읽기가 끝나 보류한다.
  held.push("second");
  // 포인터를 놓아 첫째 스티커가 놓은 위치로 확정된다.
  current = "dragged";

  // 보류한 스티커를 붙이기 직전에 기록 경계를 닫고 하나만 붙인다.
  history = pushHistory(history, current, isSame);
  const nextHeldSticker = held.shift();
  assert.equal(nextHeldSticker, "second");
  current = `${current}+${nextHeldSticker}`;

  // 첫 되돌리기: 둘째만 사라지고 첫째는 놓은 위치에 남는다.
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "dragged");
  current = history.present;

  // 두 번째 되돌리기: 첫째가 시작 위치로 돌아간다.
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "base");
});

test("App은 포인터가 눌려 있으면 완료된 스티커를 보류하고 해제 뒤 렌더마다 하나씩 붙인다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /const heldStickerRef = useRef<CanvasSticker\[\]>\(\[\]\);/);
  assert.match(
    source,
    /const shouldHoldStickerInsert = useCallback\(\s*\(\) => hasActivePointers\(pointerPresenceRef\.current\),\s*\[\],\s*\);/,
  );
  assert.match(
    source,
    /if \(shouldHoldStickerInsert\(\)\) \{\s*heldStickerRef\.current\.push\(newSticker\);[^\n]*\n\s*return;\s*\}/,
  );
  assert.match(
    source,
    /const nextHeldSticker = heldStickerRef\.current\.shift\(\);[^\n]*\n\s*if \(!nextHeldSticker\) return;\s*flushHistory\(\);[^\n]*\n\s*setStickers\(\(previous\) => \[\.\.\.previous, nextHeldSticker\]\);\s*selectInsertedSticker\(nextHeldSticker\.id\);/,
  );
  assert.match(
    source,
    /\}, \[flushHistory, isPointerActive, shouldHoldStickerInsert, selectInsertedSticker, stickers\]\);/,
  );
});

test("App은 기록 경계를 호출 시점 문서로 고정해 같은 배치의 다음 변경과 섞지 않는다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /const documentToRecord = currentDocumentRef\.current;\s*setHistory\(\(previous\) => pushHistory\(previous, documentToRecord, isSameEditorDocument\)\);/,
  );
});

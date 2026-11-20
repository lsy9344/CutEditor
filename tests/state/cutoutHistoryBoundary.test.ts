import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createHistory,
  pushHistory,
  undoHistory,
} from "../../src/state/history.ts";

const isSame = (a: string, b: string) => a === b;

test("만들기 직전 기록 경계가 앞선 변경과 누끼를 나눠 되돌리기 한 번에 누끼만 사라진다", () => {
  let history = createHistory("base");
  let current = "photo"; // 썸네일을 누르는 사이에 반영된 변경(아직 기록 전)

  // 붙이기 앞 flushHistory(): 앞선 변경을 한 단계로 닫는다.
  history = pushHistory(history, current, isSame);
  current = "photo+cutout";
  // 잠금 해제의 flushHistory()
  history = pushHistory(history, current, isSame);

  history = undoHistory(history);
  assert.equal(history.present, "photo"); // 누끼만 사라짐
  current = history.present;

  // 대조: 붙이기 앞 flushHistory()가 없으면 앞선 변경까지 함께 사라진다.
  let controlHistory = createHistory("base");
  controlHistory = pushHistory(controlHistory, "photo+cutout", isSame);
  controlHistory = undoHistory(controlHistory);
  assert.equal(controlHistory.present, "base");

  const source = readFileSync("src/App.tsx", "utf8");
  assert.match(
    source,
    /flushHistory\(\);\s*setStickers\(\(previous\) => \[\.\.\.previous, newSticker\]\);/,
  );
});

test("잠금 중 끝나 보류된 Boothy 사진은 누끼 다음 단계로 붙고 되돌리면 사진만 사라진다", () => {
  let history = createHistory("base");
  let current = "base";

  // 누끼 붙이기 앞 flushHistory()
  history = pushHistory(history, current, isSame);
  current = "cutout";
  // 잠금 해제 첫 effect의 flushHistory()
  history = pushHistory(history, current, isSame);
  // 보류한 Boothy 사진 적용
  current = "cutout+photo";

  // 첫 되돌리기: 사진만 사라짐
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "cutout");
  current = history.present;

  // 두 번째 되돌리기: 누끼만 사라짐
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "base");

  // 대조: 첫 effect의 flushHistory()가 없으면 누끼까지 함께 사라진다.
  let controlHistory = createHistory("base");
  controlHistory = pushHistory(controlHistory, "base", isSame);
  controlHistory = undoHistory(pushHistory(controlHistory, "cutout+photo", isSame));
  assert.equal(controlHistory.present, "base");

  const source = readFileSync("src/App.tsx", "utf8");
  assert.match(source, /if \(cutoutBusyId\) return;\s*flushHistory\(\);/);
  assert.match(
    source,
    /if \(isCutoutLocked\(\)\) \{\s*heldBoothyImportRef\.current = \{ file, slotId: pendingBoothyImport\.slotId \};/,
  );
});

test("잠금 중 끝난 일반 스티커 두 개는 완료 순서대로 누끼 다음에 한 단계씩 붙는다", () => {
  let history = createHistory("base");
  let current = "base";
  const held: string[] = ["A", "B"];

  // 누끼 붙이기 앞 flushHistory()
  history = pushHistory(history, current, isSame);
  current = "cutout";
  // 잠금 해제 첫 effect의 flushHistory()
  history = pushHistory(history, current, isSame);

  // 둘째 effect를 held가 빌 때까지 렌더마다 한 번 실행
  while (held.length > 0) {
    const next = held.shift();
    if (!next) break;
    history = pushHistory(history, current, isSame);
    current = `${current}+${next}`;
  }

  assert.equal(current, "cutout+A+B");
  assert.deepEqual(held, []);

  // 되돌릴 때마다 늦게 붙은 스티커부터 하나씩 사라진다.
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "cutout+A");
  current = history.present;

  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "cutout");
  current = history.present;

  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "base");

  // 대조: 둘째 effect의 flushHistory()가 없으면 두 스티커가 함께 사라진다.
  let controlHistory = createHistory("base");
  controlHistory = pushHistory(controlHistory, "base", isSame);
  controlHistory = pushHistory(controlHistory, "cutout", isSame);
  controlHistory = undoHistory(pushHistory(controlHistory, "cutout+A+B", isSame));
  assert.equal(controlHistory.present, "cutout");

  const source = readFileSync("src/App.tsx", "utf8");
  assert.match(
    source,
    /if \(isCutoutLocked\(\)\) \{\s*heldStickerRef\.current\.push\(newSticker\);/,
  );
  assert.match(
    source,
    /const nextHeldSticker = heldStickerRef\.current\.shift\(\);[^\n]*\s*if \(!nextHeldSticker\) return;\s*flushHistory\(\);[^\n]*\s*setStickers\(\(previous\) => \[\.\.\.previous, nextHeldSticker\]\);/,
  );
  assert.match(source, /\}, \[cutoutBusyId, stickers\]\);/);
});

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

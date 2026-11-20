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

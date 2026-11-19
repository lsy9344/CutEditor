import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  beginPointer,
  createPointerPresence,
  endPointer,
  hasActivePointers,
  resetPointers,
} from "../../src/state/pointerPresence.ts";

test("beginPointer는 첫 포인터에서만 새 제스처 시작을 알린다", () => {
  const presence = createPointerPresence();

  assert.equal(hasActivePointers(presence), false);
  assert.equal(beginPointer(presence, 1), true);
  assert.equal(hasActivePointers(presence), true);
  assert.equal(beginPointer(presence, 2), false);
  assert.equal(beginPointer(presence, 2), false);
  assert.equal(presence.activePointerIds.size, 2);
});

test("endPointer는 마지막 포인터가 풀릴 때만 제스처 종료를 알린다", () => {
  const presence = createPointerPresence();
  beginPointer(presence, 1);
  beginPointer(presence, 2);

  assert.equal(endPointer(presence, 1), false);
  assert.equal(hasActivePointers(presence), true);
  assert.equal(endPointer(presence, 2), true);
  assert.equal(hasActivePointers(presence), false);
  assert.equal(endPointer(presence, 2), false);
});

test("resetPointers는 창 밖 해제·취소 뒤 남은 포인터를 모두 지운다", () => {
  const presence = createPointerPresence();
  assert.equal(resetPointers(presence), false);

  beginPointer(presence, 3);
  beginPointer(presence, 4);
  assert.equal(resetPointers(presence), true);
  assert.equal(hasActivePointers(presence), false);
  assert.equal(presence.activePointerIds.size, 0);
});

test("App은 포인터를 누르고 있는 동안 400ms 기록을 미루고 마지막 해제 뒤에 기록한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /if \(isPointerActive\) return;/);
  assert.match(source, /window\.addEventListener\("pointerdown", onPointerDown, true\);/);
  assert.match(source, /window\.addEventListener\("pointerup", onPointerEnd, true\);/);
  assert.match(source, /window\.addEventListener\("pointercancel", onPointerEnd, true\);/);
  assert.match(source, /window\.addEventListener\("blur", onPointerReset\);/);
  assert.match(source, /if \(!beginPointer\(presence, event\.pointerId\)\) return;/);
  assert.match(source, /\[currentDocument, flushHistory, isPointerActive\]/);
});

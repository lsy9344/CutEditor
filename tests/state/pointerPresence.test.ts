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
  assert.equal(beginPointer(presence, 1, true), true);
  assert.equal(hasActivePointers(presence), true);
  assert.equal(beginPointer(presence, 2, false), false);
  assert.equal(beginPointer(presence, 2, false), false);
  assert.equal(presence.activePointerIds.size, 2);
});

test("endPointer는 마지막 포인터가 풀릴 때만 제스처 종료를 알린다", () => {
  const presence = createPointerPresence();
  beginPointer(presence, 1, true);
  beginPointer(presence, 2, false);

  assert.equal(endPointer(presence, 1), false);
  assert.equal(hasActivePointers(presence), true);
  assert.equal(endPointer(presence, 2), true);
  assert.equal(hasActivePointers(presence), false);
  assert.equal(endPointer(presence, 2), false);
});

test("resetPointers는 창 밖 해제·취소 뒤 남은 포인터를 모두 지운다", () => {
  const presence = createPointerPresence();
  assert.equal(resetPointers(presence), false);

  beginPointer(presence, 3, true);
  beginPointer(presence, 4, false);
  assert.equal(resetPointers(presence), true);
  assert.equal(hasActivePointers(presence), false);
  assert.equal(presence.activePointerIds.size, 0);
});

test("종료를 놓친 포인터가 남아도 새 기본 포인터가 눌렸다 떨어지면 다시 포인터 없음으로 돌아온다", () => {
  const presence = createPointerPresence();
  beginPointer(presence, 7, true); // pointerup 한 건을 놓쳐 기록이 남은 상태
  assert.equal(hasActivePointers(presence), true);

  assert.equal(beginPointer(presence, 8, true), true); // 새 기본 포인터가 남은 기록을 지우고 새로 시작
  assert.deepEqual(Array.from(presence.activePointerIds), [8]);
  assert.equal(endPointer(presence, 8), true);
  assert.equal(hasActivePointers(presence), false);
});

test("둘째 손가락 추가·제거는 첫 포인터 기록을 지우지 않는다", () => {
  const presence = createPointerPresence();
  assert.equal(beginPointer(presence, 1, true), true);

  assert.equal(beginPointer(presence, 2, false), false);
  assert.deepEqual(Array.from(presence.activePointerIds).sort(), [1, 2]);

  assert.equal(endPointer(presence, 2), false);
  assert.deepEqual(Array.from(presence.activePointerIds), [1]);
  assert.equal(endPointer(presence, 1), true);
});

test("App은 포인터를 누르고 있는 동안 400ms 기록을 미루고 마지막 해제 뒤에 기록한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /if \(isPointerActive\) return;/);
  assert.match(source, /window\.addEventListener\("pointerdown", onPointerDown, true\);/);
  assert.match(source, /window\.addEventListener\("pointerup", onPointerEnd, true\);/);
  assert.match(source, /window\.addEventListener\("pointercancel", onPointerEnd, true\);/);
  assert.match(source, /window\.addEventListener\("blur", onPointerReset\);/);
  assert.match(source, /if \(!beginPointer\(presence, event\.pointerId, event\.isPrimary\)\) return;/);
  assert.match(source, /\[currentDocument, flushHistory, isPointerActive\]/);
});

import test from "node:test";
import assert from "node:assert/strict";

import { getAngleInputValue } from "../../src/canvas/keyboardShortcuts.ts";

// UX5-6: 각도 칸의 임시값은 대상 ID에 묶습니다. 대상이 바뀌면 옛 대상에 쓰던 값을 버리고 새 대상의 각도를 보입니다.
test("같은 대상에 쓰는 중인 임시값은 그대로 보인다(음수·빈 값 입력 중)", () => {
  assert.equal(getAngleInputValue({ draft: { targetId: "sticker-1", text: "-" }, targetId: "sticker-1", rotation: 0 }), "-");
  assert.equal(getAngleInputValue({ draft: { targetId: "sticker-1", text: "" }, targetId: "sticker-1", rotation: 12 }), "");
});

test("대상 ID가 바뀌면 임시값을 버리고 새 대상의 각도를 보인다", () => {
  assert.equal(getAngleInputValue({ draft: { targetId: "sticker-1", text: "7" }, targetId: "sticker-2", rotation: 0 }), "0");
  assert.equal(getAngleInputValue({ draft: { targetId: "text-1", text: "7" }, targetId: "text-2", rotation: 33.4 }), "33");
});

test("임시값이 없으면 대상의 각도를 반올림해 보인다", () => {
  assert.equal(getAngleInputValue({ draft: null, targetId: "sticker-1", rotation: -44.6 }), "-45");
});

test("대상이 없으면 임시값이 남아 있어도 현재 각도를 보인다", () => {
  assert.equal(getAngleInputValue({ draft: { targetId: "text-1", text: "9" }, targetId: null, rotation: 0 }), "0");
});

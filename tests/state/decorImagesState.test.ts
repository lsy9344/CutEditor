import test from "node:test";
import assert from "node:assert/strict";

import { getDecorImagesState, isFrameColorApplied } from "../../src/state/decorImagesState.ts";
import type { DecorImagesInput } from "../../src/state/decorImagesState.ts";

const readyInput = (override: Partial<DecorImagesInput> = {}): DecorImagesInput => ({
  frameLoad: "loaded",
  isFrameColorApplied: true,
  stickers: [{ isLoaded: true, isFailed: false }],
  ...override,
});

test("프레임을 불러왔고 색도 적용했고 스티커도 올라왔으면 ready다", () => {
  assert.deepEqual(getDecorImagesState(readyInput()), { kind: "ready", failedStickerCount: 0 });
});

test("프레임을 고르지 않았거나 스티커가 없으면 기다릴 것이 없다", () => {
  assert.deepEqual(getDecorImagesState(readyInput({ frameLoad: "none", isFrameColorApplied: false, stickers: [] })), { kind: "ready", failedStickerCount: 0 });
});

test("프레임 이미지를 불러오는 중이면 loading이다(UX4-2)", () => {
  assert.deepEqual(getDecorImagesState(readyInput({ frameLoad: "loading", isFrameColorApplied: false })), { kind: "loading" });
});

test("프레임을 불러왔어도 색 적용 전이면 loading이다(UX4-2)", () => {
  assert.deepEqual(getDecorImagesState(readyInput({ isFrameColorApplied: false })), { kind: "loading" });
});

test("일반 스티커 이미지를 불러오는 중이면 loading이다(UX4-2)", () => {
  const stickers = [{ isLoaded: true, isFailed: false }, { isLoaded: false, isFailed: false }];
  assert.deepEqual(getDecorImagesState(readyInput({ stickers })), { kind: "loading" });
});

test("프레임 이미지를 모든 후보에서 읽지 못하면 failed이고 스티커를 기다리는 중이어도 failed다", () => {
  assert.deepEqual(getDecorImagesState(readyInput({ frameLoad: "failed", isFrameColorApplied: false })), { kind: "failed" });
  const stickers = [{ isLoaded: false, isFailed: false }];
  assert.deepEqual(getDecorImagesState(readyInput({ frameLoad: "failed", isFrameColorApplied: false, stickers })), { kind: "failed" });
});

test("읽지 못한 일반 스티커는 저장을 막지 않고 몇 개인지 함께 알린다(UX5-4)", () => {
  const stickers = [{ isLoaded: false, isFailed: true }, { isLoaded: true, isFailed: false }, { isLoaded: false, isFailed: true }];
  assert.deepEqual(getDecorImagesState(readyInput({ stickers })), { kind: "ready", failedStickerCount: 2 });
});

test("일반 스티커를 기다리는 중이면 이미 읽지 못한 스티커가 있어도 loading이다(UX5-4)", () => {
  const stickers = [{ isLoaded: false, isFailed: true }, { isLoaded: false, isFailed: false }];
  assert.deepEqual(getDecorImagesState(readyInput({ stickers })), { kind: "loading" });
});

test("색 적용 기록은 같은 이미지·같은 색일 때만 적용됨으로 본다", () => {
  const frameImage = { name: "frame" };
  const otherImage = { name: "other-frame" };
  assert.equal(isFrameColorApplied({ image: frameImage, color: "#000000" }, frameImage, "#000000"), true);
  assert.equal(isFrameColorApplied({ image: frameImage, color: "#FFFFFF" }, frameImage, "#000000"), false, "색이 바뀌었는데 옛 색 기록을 씁니다");
  assert.equal(isFrameColorApplied({ image: otherImage, color: "#000000" }, frameImage, "#000000"), false, "다른 프레임의 기록을 씁니다");
  assert.equal(isFrameColorApplied(null, frameImage, "#000000"), false);
  assert.equal(isFrameColorApplied({ image: null, color: "#000000" }, null, "#000000"), false, "프레임 이미지가 없는데 적용됨으로 봅니다");
});

import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("텍스트 박스 폭만 커진 경우에도 저장되는 fontSize가 함께 커진다", async () => {
  const { getNextTextTransformState } = await loadTsModule("src/canvas/textTransform.ts");

  const result = getNextTextTransformState({
    boxWidth: 160,
    fontSize: 16,
  }, {
    x: 120,
    y: 240,
    rotation: 12,
    width: 320,
    scaleX: 1,
    scaleY: 1,
  });

  assert.deepEqual(result, {
    x: 120,
    y: 240,
    rotation: 12,
    boxWidth: 320,
    fontSize: 32,
  });
});

test("연속 리사이즈에서도 직전 텍스트 크기를 기준으로 다시 계산한다", async () => {
  const { getNextTextTransformState } = await loadTsModule("src/canvas/textTransform.ts");

  const firstResize = getNextTextTransformState({
    boxWidth: 200,
    fontSize: 20,
  }, {
    x: 80,
    y: 160,
    rotation: 0,
    width: 300,
    scaleX: 1,
    scaleY: 1,
  });

  const secondResize = getNextTextTransformState({
    boxWidth: firstResize.boxWidth,
    fontSize: firstResize.fontSize,
  }, {
    x: 80,
    y: 160,
    rotation: 0,
    width: 450,
    scaleX: 1,
    scaleY: 1,
  });

  assert.equal(firstResize.fontSize, 30);
  assert.equal(secondResize.fontSize, 45);
  assert.equal(secondResize.boxWidth, 450);
});

test("기존처럼 scale 값으로만 전달되는 경우도 동일하게 동작한다", async () => {
  const { getNextTextTransformState } = await loadTsModule("src/canvas/textTransform.ts");

  const result = getNextTextTransformState({
    boxWidth: 180,
    fontSize: 18,
  }, {
    x: 0,
    y: 0,
    rotation: 0,
    width: 180,
    scaleX: 2,
    scaleY: 2,
  });

  assert.equal(result.boxWidth, 360);
  assert.equal(result.fontSize, 36);
});

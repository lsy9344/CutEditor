import test from "node:test";
import assert from "node:assert/strict";

import {
  BRUSH_SCREEN_RADIUS,
  BRUSH_SIZE_OPTIONS,
  getLocalBrushRadius,
  toNormalizedStroke,
} from "../../src/photo/photoTool.ts";

test("로컬 좌표를 0..1 획으로 정규화한다", () => {
  const stroke = toNormalizedStroke([50, 25, 100, 50], 200, 100, 8);

  assert.deepEqual(stroke, { points: [0.25, 0.25, 0.5, 0.5], radius: 0.04 });
});

test("사진 밖의 점은 버리고 남은 점으로 획을 만든다", () => {
  const stroke = toNormalizedStroke([-10, 20, 50, 25], 200, 100, 8);

  assert.deepEqual(stroke, { points: [0.25, 0.25], radius: 0.04 });
});

test("남은 점이 없으면 null이다", () => {
  const stroke = toNormalizedStroke([-10, 20], 200, 100, 8);

  assert.equal(stroke, null);
});

test("화면 반지름을 절댓값 배율로 나눠 로컬 반지름을 구한다", () => {
  assert.equal(getLocalBrushRadius(16, 2), 8);
  assert.equal(getLocalBrushRadius(16, -2), 8);
});

test("붓 크기 상수와 선택지 문구가 정해진 값이다", () => {
  assert.deepEqual(BRUSH_SCREEN_RADIUS, { small: 8, medium: 16, large: 28 });
  assert.deepEqual(
    BRUSH_SIZE_OPTIONS.map((option) => option.label),
    ["작게", "보통", "크게"],
  );
});

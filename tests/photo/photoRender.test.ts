import test from "node:test";
import assert from "node:assert/strict";

import type { BrushStroke } from "../../src/photo/photoEdits.ts";
import {
  applyEraseStroke,
  applyEraseStrokes,
  getWorkingSize,
  isStrokeSeparatedFromStrokes,
  isPhotoWorkingSizeClamped,
} from "../../src/photo/photoRender.ts";

function createGradientImage(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = Math.round((x / (width - 1)) * 255);
      data[index + 1] = Math.round((y / (height - 1)) * 255);
      data[index + 2] = (x + y) % 256;
      data[index + 3] = 255;
    }
  }
  return data;
}

function createStripeImage(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const isRed = (x + Math.floor(y / 5)) % 19 < 9;
      data[index] = isRed ? 255 : 0;
      data[index + 1] = isRed ? 0 : 255;
      data[index + 2] = isRed ? 0 : 255;
      data[index + 3] = 255;
    }
  }
  return data;
}

function renderOneStrokeAtATime(
  base: Uint8ClampedArray,
  width: number,
  height: number,
  strokes: BrushStroke[],
): Uint8ClampedArray {
  let current = Uint8ClampedArray.from(base);
  const applied: BrushStroke[] = [];
  for (const stroke of strokes) {
    if (applied.length > 0 && !isStrokeSeparatedFromStrokes(stroke, applied, width, height)) {
      current = Uint8ClampedArray.from(base);
      applyEraseStrokes(current, width, height, [...applied, stroke]);
    } else {
      applyEraseStroke(current, width, height, stroke);
    }
    applied.push(stroke);
  }
  return current;
}

function assertSamePixels(
  base: Uint8ClampedArray,
  width: number,
  height: number,
  strokes: BrushStroke[],
): void {
  const oneByOne = renderOneStrokeAtATime(base, width, height, strokes);
  const redrawn = Uint8ClampedArray.from(base);
  applyEraseStrokes(redrawn, width, height, strokes);

  assert.deepEqual(Array.from(oneByOne), Array.from(redrawn));
}

const farStrokes: BrushStroke[] = [
  { points: [0.2, 0.3], radius: 0.02 },
  { points: [0.72, 0.28], radius: 0.02 },
  { points: [0.45, 0.72], radius: 0.02 },
];

const closeStrokes: BrushStroke[] = [
  { points: [0.4, 0.5], radius: 0.02 },
  { points: [0.46, 0.5], radius: 0.02 },
  { points: [0.75, 0.6], radius: 0.02 },
];

test("긴 변이 2048을 넘으면 긴 변을 2048로 줄인다", () => {
  assert.deepEqual(getWorkingSize(4000, 3000, 2048), { width: 2048, height: 1536 });
});

test("긴 변이 상한 이하이면 원래 크기를 그대로 둔다", () => {
  assert.deepEqual(getWorkingSize(1000, 800, 2048), { width: 1000, height: 800 });
});

test("세로 사진도 긴 변이 상한 이하이면 키우지 않는다", () => {
  assert.deepEqual(getWorkingSize(3000, 4000, 4096), { width: 3000, height: 4000 });
});

test("가로 사진은 짧은 변을 반올림해 비율을 맞춘다", () => {
  assert.deepEqual(getWorkingSize(5000, 2000, 4096), { width: 4096, height: 1638 });
});

test("세로 사진은 짧은 변을 반올림해 비율을 맞춘다", () => {
  assert.deepEqual(getWorkingSize(2000, 5000, 2048), { width: 819, height: 2048 });
});

test("짧은 변이 0으로 반올림되는 극단 비율도 작업 크기는 최소 1px이다", () => {
  assert.deepEqual(getWorkingSize(1, 8193, 4096), { width: 1, height: 4096 });
  assert.deepEqual(getWorkingSize(8193, 1, 4096), { width: 4096, height: 1 });
  assert.deepEqual(getWorkingSize(1, 8193, 2048), { width: 1, height: 2048 });
});

test("짧은 변을 1px로 잘라야 하는 극단 비율만 렌더 실패로 판정한다", () => {
  assert.equal(isPhotoWorkingSizeClamped(1, 8193, 4096), true);
  assert.equal(isPhotoWorkingSizeClamped(8193, 1, 4096), true);
  assert.equal(isPhotoWorkingSizeClamped(1, 8193, 2048), true);
  assert.equal(isPhotoWorkingSizeClamped(2, 8193, 4096), false);
  assert.equal(isPhotoWorkingSizeClamped(1, 4096, 4096), false);
  assert.equal(isPhotoWorkingSizeClamped(4000, 3000, 2048), false);
});

test("떨어진 새 획만 이전 지우기 결과 위에 따로 메울 수 있다", () => {
  const previous = [{ points: [0.1, 0.5], radius: 0.01 }];
  const farStroke = { points: [0.5, 0.5], radius: 0.01 };
  const nearStroke = { points: [0.12, 0.5], radius: 0.01 };

  assert.equal(isStrokeSeparatedFromStrokes(farStroke, previous, 1000, 1000), true);
  assert.equal(isStrokeSeparatedFromStrokes(nearStroke, previous, 1000, 1000), false);
  assert.equal(isStrokeSeparatedFromStrokes(farStroke, [], 1000, 1000), true);
});

test("P3-6 그라데이션에서 떨어진 획은 한 획씩 더한 결과와 처음부터 그린 결과가 같다", () => {
  const width = 400;
  const height = 260;
  const base = createGradientImage(width, height);

  assertSamePixels(base, width, height, farStrokes);
});

test("P3-6 줄무늬에서 떨어진 획은 한 획씩 더한 결과와 처음부터 그린 결과가 같다", () => {
  const width = 400;
  const height = 260;
  const base = createStripeImage(width, height);

  assertSamePixels(base, width, height, farStrokes);
});

test("P3-6 메움 주변이 가깝지만 겹치지 않는 두 획도 경로에 따라 같은 픽셀을 낸다", () => {
  const width = 400;
  const height = 260;
  const gradientBase = createGradientImage(width, height);
  const stripeBase = createStripeImage(width, height);

  assertSamePixels(gradientBase, width, height, closeStrokes);
  assertSamePixels(stripeBase, width, height, closeStrokes);
});

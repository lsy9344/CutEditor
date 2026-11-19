import test from "node:test";
import assert from "node:assert/strict";

import { applyPhotoAdjust } from "../../src/photo/photoAdjust.ts";
import type { PhotoAdjust } from "../../src/photo/photoEdits.ts";

function adjust(overrides: Partial<PhotoAdjust>): PhotoAdjust {
  return { brightness: 0, contrast: 0, saturation: 0, warmth: 0, ...overrides };
}

test("밝기 10은 각 채널에 12.8을 더한다", () => {
  const data = new Uint8ClampedArray([100, 100, 100, 255]);

  applyPhotoAdjust(data, adjust({ brightness: 10 }));

  assert.deepEqual(Array.from(data), [113, 113, 113, 255]);
});

test("대비 100은 128을 중심으로 두 배로 벌리고 0..255로 자른다", () => {
  const data = new Uint8ClampedArray([192, 64, 128, 255]);

  applyPhotoAdjust(data, adjust({ contrast: 100 }));

  assert.deepEqual(Array.from(data), [255, 0, 128, 255]);
});

test("채도 -100은 회색값으로 만든다", () => {
  const data = new Uint8ClampedArray([200, 100, 50, 255]);

  applyPhotoAdjust(data, adjust({ saturation: -100 }));

  assert.deepEqual(Array.from(data), [124, 124, 124, 255]);
});

test("따뜻하게 100은 R을 30 올리고 B를 30 내린다", () => {
  const data = new Uint8ClampedArray([100, 100, 100, 255]);

  applyPhotoAdjust(data, adjust({ warmth: 100 }));

  assert.deepEqual(Array.from(data), [130, 100, 70, 255]);
});

test("밝기를 바꿔도 알파는 그대로 둔다", () => {
  const data = new Uint8ClampedArray([10, 20, 30, 77]);

  applyPhotoAdjust(data, adjust({ brightness: 50 }));

  assert.equal(data[3], 77);
});

test("중간 단계에서 자르지 않아 밝기 100과 대비 -50이 228을 만든다", () => {
  const data = new Uint8ClampedArray([200, 200, 200, 255]);

  applyPhotoAdjust(data, adjust({ brightness: 100, contrast: -50 }));

  assert.deepEqual(Array.from(data), [228, 228, 228, 255]);
});

test("밝기 10과 대비 100을 합성해 154를 만든다", () => {
  const data = new Uint8ClampedArray([128, 128, 128, 255]);

  applyPhotoAdjust(data, adjust({ brightness: 10, contrast: 100 }));

  assert.deepEqual(Array.from(data), [154, 154, 154, 255]);
});

test("모든 값이 0이면 픽셀을 바꾸지 않는다", () => {
  const data = new Uint8ClampedArray([1, 2, 3, 4]);

  applyPhotoAdjust(data, adjust({}));

  assert.deepEqual(Array.from(data), [1, 2, 3, 4]);
});

test("모든 픽셀을 한 번에 처리한다", () => {
  const data = new Uint8ClampedArray([100, 100, 100, 255, 192, 64, 128, 255]);

  applyPhotoAdjust(data, adjust({ contrast: 100 }));

  assert.deepEqual(Array.from(data.slice(4)), [255, 0, 128, 255]);
});

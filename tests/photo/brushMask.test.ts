import test from "node:test";
import assert from "node:assert/strict";

import { rasterizeStroke } from "../../src/photo/brushMask.ts";

function countOnes(mask: Uint8Array): number {
  let count = 0;
  for (let index = 0; index < mask.length; index += 1) count += mask[index];
  return count;
}

test("한 점 획은 반지름 안의 픽셀을 칠한다", () => {
  const mask = new Uint8Array(20 * 20);

  rasterizeStroke({ points: [0.5, 0.5], radius: 0.1 }, 20, 20, mask);

  assert.equal(countOnes(mask), 12);
  assert.equal(mask[10 * 20 + 10], 1);
  assert.equal(mask[9 * 20 + 9], 1);
  assert.equal(mask[9 * 20 + 8], 1);
  assert.equal(mask[8 * 20 + 8], 0);
});

test("같은 획을 두 번 그려도 마스크는 그대로다", () => {
  const mask = new Uint8Array(20 * 20);
  const stroke = { points: [0.5, 0.5], radius: 0.1 };

  rasterizeStroke(stroke, 20, 20, mask);
  rasterizeStroke(stroke, 20, 20, mask);

  assert.equal(countOnes(mask), 12);
});

test("이웃한 두 점은 선분을 따라 칠한다", () => {
  const mask = new Uint8Array(20 * 10);

  rasterizeStroke({ points: [0.25, 0.5, 0.75, 0.5], radius: 0.05 }, 20, 10, mask);

  assert.equal(countOnes(mask), 24);
  assert.equal(mask[5 * 20 + 4], 1);
  assert.equal(mask[5 * 20 + 15], 1);
  assert.equal(mask[5 * 20 + 16], 0);
  assert.equal(mask[3 * 20 + 10], 0);
});

test("이미지 밖의 점은 아무것도 칠하지 않는다", () => {
  const mask = new Uint8Array(20 * 20);

  rasterizeStroke({ points: [1.2, 0.5], radius: 0.1 }, 20, 20, mask);

  assert.equal(countOnes(mask), 0);
});

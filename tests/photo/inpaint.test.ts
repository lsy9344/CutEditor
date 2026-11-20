import test from "node:test";
import assert from "node:assert/strict";

import { inpaintMasked } from "../../src/photo/inpaint.ts";

function createGradientImage(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = x * 8;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  }
  return data;
}

function paintMask(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  color: [number, number, number, number],
): void {
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    data[index * 4] = color[0];
    data[index * 4 + 1] = color[1];
    data[index * 4 + 2] = color[2];
    data[index * 4 + 3] = color[3];
  }
}

test("단색 이미지의 구멍은 주변과 같은 색으로 메운다", () => {
  const width = 32;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 100;
    data[index * 4 + 1] = 150;
    data[index * 4 + 2] = 200;
    data[index * 4 + 3] = 255;
  }
  const mask = new Uint8Array(width * height);
  for (let y = 13; y <= 18; y += 1) {
    for (let x = 13; x <= 18; x += 1) mask[y * width + x] = 1;
  }
  paintMask(data, mask, [0, 0, 0, 255]);

  inpaintMasked(data, width, height, mask);

  const expected = new Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    expected[index * 4] = 100;
    expected[index * 4 + 1] = 150;
    expected[index * 4 + 2] = 200;
    expected[index * 4 + 3] = 255;
  }
  assert.deepEqual(Array.from(data), expected);
});

test("가로 그라데이션의 구멍은 좌우 값 사이로 메우고 알파는 유지한다", () => {
  const width = 32;
  const height = 32;
  const data = createGradientImage(width, height);
  const before = Uint8ClampedArray.from(data);
  const mask = new Uint8Array(width * height);
  for (let y = 12; y <= 19; y += 1) {
    for (let x = 12; x <= 19; x += 1) mask[y * width + x] = 1;
  }
  paintMask(data, mask, [255, 255, 255, 200]);

  inpaintMasked(data, width, height, mask);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) {
        assert.deepEqual(
          Array.from(data.subarray(index * 4, index * 4 + 4)),
          Array.from(before.subarray(index * 4, index * 4 + 4)),
        );
        continue;
      }
      const r = data[index * 4];
      assert.ok(r >= 88 && r <= 160, `R ${r} at ${x},${y}`);
      assert.equal(data[index * 4 + 1], 0);
      assert.equal(data[index * 4 + 2], 0);
      assert.equal(data[index * 4 + 3], 200);
    }
  }
  const row = 15;
  const rowR: number[] = [];
  for (let x = 11; x <= 20; x += 1) rowR.push(data[(row * width + x) * 4]);
  assert.deepEqual(rowR, [88, 96, 104, 112, 120, 128, 136, 144, 152, 160]);
});

test("마스크가 비어 있으면 아무것도 바꾸지 않는다", () => {
  const width = 32;
  const height = 32;
  const data = createGradientImage(width, height);
  const before = Uint8ClampedArray.from(data);
  const mask = new Uint8Array(width * height);

  inpaintMasked(data, width, height, mask);

  assert.deepEqual(Array.from(data), Array.from(before));
});

test("마스크가 이미지 전체면 아무것도 바꾸지 않는다", () => {
  const width = 32;
  const height = 32;
  const data = createGradientImage(width, height);
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) mask[index] = 1;
  paintMask(data, mask, [255, 255, 255, 200]);
  const before = Uint8ClampedArray.from(data);

  inpaintMasked(data, width, height, mask);

  assert.deepEqual(Array.from(data), Array.from(before));
});

test("서로 떨어진 마스크는 각자의 주변색으로 따로 메운다", () => {
  const width = 60;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const isLeft = x < width / 2;
      data[index] = isLeft ? 220 : 30;
      data[index + 1] = 30;
      data[index + 2] = isLeft ? 30 : 220;
      data[index + 3] = 255;
    }
  }
  const mask = new Uint8Array(width * height);
  for (let y = 9; y <= 11; y += 1) {
    for (let x = 0; x <= 2; x += 1) mask[y * width + x] = 1;
    for (let x = 57; x <= 59; x += 1) mask[y * width + x] = 1;
  }
  paintMask(data, mask, [0, 0, 0, 255]);

  inpaintMasked(data, width, height, mask);

  const leftIndex = (10 * width + 1) * 4;
  const rightIndex = (10 * width + 58) * 4;
  assert.ok(data[leftIndex] > 200, `왼쪽 R ${data[leftIndex]}`);
  assert.ok(data[leftIndex + 2] < 60, `왼쪽 B ${data[leftIndex + 2]}`);
  assert.ok(data[rightIndex + 2] > 200, `오른쪽 B ${data[rightIndex + 2]}`);
  assert.ok(data[rightIndex] < 60, `오른쪽 R ${data[rightIndex]}`);
  assert.equal(data[leftIndex + 3], 255);
  assert.equal(data[rightIndex + 3], 255);
});

test("멀리 떨어진 두 마스크도 단색으로 정확히 메운다", () => {
  const width = 2048;
  const height = 2048;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(200);
  const mask = new Uint8Array(width * height);
  for (const [centerX, centerY] of [
    [12, 12],
    [2035, 2035],
  ]) {
    for (let y = centerY - 2; y <= centerY + 2; y += 1) {
      for (let x = centerX - 2; x <= centerX + 2; x += 1) mask[y * width + x] = 1;
    }
  }
  paintMask(data, mask, [0, 0, 0, 200]);

  inpaintMasked(data, width, height, mask);

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    assert.equal(data[index * 4], 200);
    assert.equal(data[index * 4 + 1], 200);
    assert.equal(data[index * 4 + 2], 200);
    assert.equal(data[index * 4 + 3], 200);
  }
});

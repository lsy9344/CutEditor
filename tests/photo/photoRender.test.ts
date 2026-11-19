import test from "node:test";
import assert from "node:assert/strict";

import { getWorkingSize, isPhotoWorkingSizeClamped } from "../../src/photo/photoRender.ts";

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

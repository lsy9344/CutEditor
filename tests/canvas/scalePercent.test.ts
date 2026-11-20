import test from "node:test";
import assert from "node:assert/strict";

import {
  getAngleInputDegrees,
  getScaleFromPercent,
  getScalePercent,
} from "../../src/canvas/keyboardShortcuts.ts";

test("크기 배율을 정수 퍼센트로 보인다(숫자가 아니면 100)", () => {
  assert.equal(getScalePercent(1), 100);
  assert.equal(getScalePercent(0.456), 46);
  assert.equal(getScalePercent(2), 200);
  assert.equal(getScalePercent(NaN), 100);
});

test("퍼센트 입력을 배율로 바꾼다(0 이하와 숫자가 아닌 값은 무시, 최소 0.1배)", () => {
  assert.equal(getScaleFromPercent(150), 1.5);
  assert.equal(getScaleFromPercent(5), 0.1);
  assert.equal(getScaleFromPercent(0), null);
  assert.equal(getScaleFromPercent(-10), null);
  assert.equal(getScaleFromPercent(NaN), null);
  assert.equal(getScaleFromPercent(Infinity), null);
});

test("각도 입력은 정수로 반올림해 적용하고 숫자가 아니면 무시한다", () => {
  assert.equal(getAngleInputDegrees(7), 7);
  assert.equal(getAngleInputDegrees(7.5), 8);
  assert.equal(getAngleInputDegrees(-7.5), -7);
  assert.equal(getAngleInputDegrees(-7), -7);
  assert.equal(getAngleInputDegrees(NaN), null);
  assert.equal(getAngleInputDegrees(Infinity), null);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  getCanvasEscapeAction,
  getCenterRotatedTransform,
  getCenterScaledTransform,
  isActivationKey,
  isTabLeavingImages,
} from "../../src/canvas/keyboardShortcuts.ts";

const TOLERANCE = 1e-9;

const makeImage = (id: string, slotId: string) => ({ id, slotId, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });

const assertClose = (actual: number, expected: number, label: string) => {
  assert.ok(Math.abs(actual - expected) < TOLERANCE, `${label}: expected ${expected}, received ${actual}`);
};

// 왼쪽 위 기준 변형의 화면상 가운데: (x, y) + R(rotation)(scaleX·w/2, scaleY·h/2)
const getVisualCenter = (
  item: { x: number; y: number; scaleX: number; scaleY: number; rotation: number },
  size: { width: number; height: number },
) => {
  const radians = (item.rotation * Math.PI) / 180;
  const halfWidth = (item.scaleX * size.width) / 2;
  const halfHeight = (item.scaleY * size.height) / 2;
  return {
    x: item.x + halfWidth * Math.cos(radians) - halfHeight * Math.sin(radians),
    y: item.y + halfWidth * Math.sin(radians) + halfHeight * Math.cos(radians),
  };
};

const slotOrder = ["slot-1", "slot-2", "slot-3", "slot-4"];
const photos = [makeImage("a", "slot-1"), makeImage("b", "slot-2"), makeImage("c", "slot-3")];

const isLeaving = (selection: string | null, selectedSlot: string | null, direction: 1 | -1) =>
  isTabLeavingImages({ selection, selectedSlot, slotOrder, userImages: photos, direction });

test("가운데 기준 돌리기: 100×50, 90도 돌리면 x 75, y -25, rotation 90이 된다", () => {
  const result = getCenterRotatedTransform({
    image: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    displaySize: { width: 100, height: 50 },
    deltaDegrees: 90,
  });

  assertClose(result.x, 75, "x");
  assertClose(result.y, -25, "y");
  assertClose(result.rotation, 90, "rotation");
});

test("가운데 기준 돌리기: 확대·기울어진 사진도 돌리기 전후 가운데가 같다", () => {
  const image = { x: 10, y: 20, scaleX: 2, scaleY: 2, rotation: 30 };
  const displaySize = { width: 80, height: 60 };

  const result = getCenterRotatedTransform({ image, displaySize, deltaDegrees: -90 });

  const before = getVisualCenter(image, displaySize);
  const after = getVisualCenter({ ...image, x: result.x, y: result.y, rotation: result.rotation }, displaySize);
  assertClose(after.x, before.x, "center x");
  assertClose(after.y, before.y, "center y");
  assertClose(result.rotation, -60, "rotation");
});

test("가운데 기준 돌리기: 유한하지 않은 값은 0, 0, 1, 1, 0으로 보고 계산한다", () => {
  const result = getCenterRotatedTransform({
    image: { x: Number.NaN, y: Number.POSITIVE_INFINITY, scaleX: Number.NaN, scaleY: Number.NaN, rotation: Number.NaN },
    displaySize: { width: 100, height: 50 },
    deltaDegrees: 90,
  });

  assertClose(result.x, 75, "x");
  assertClose(result.y, -25, "y");
  assertClose(result.rotation, 90, "rotation");
});

test("isActivationKey는 Enter와 Space만 true다", () => {
  assert.equal(isActivationKey("Enter"), true);
  assert.equal(isActivationKey(" "), true);
  assert.equal(isActivationKey("Tab"), false);
  assert.equal(isActivationKey("a"), false);
  assert.equal(isActivationKey("Spacebar"), false);
});

test("Tab 앞으로: 마지막 사진에서만 캔버스 밖으로 나간다", () => {
  assert.equal(isLeaving(null, null, 1), false);
  assert.equal(isLeaving("a", "slot-1", 1), false);
  assert.equal(isLeaving("b", "slot-2", 1), false);
  assert.equal(isLeaving("c", "slot-3", 1), true);
});

test("Tab 뒤로: 선택이 없거나 첫 사진이면 캔버스 밖으로 나간다", () => {
  assert.equal(isLeaving(null, null, -1), true);
  assert.equal(isLeaving("a", "slot-1", -1), true);
  assert.equal(isLeaving("b", "slot-2", -1), false);
  assert.equal(isLeaving("c", "slot-3", -1), false);
});

test("Tab: 사진이 없으면 앞뒤 모두 밖으로 나가고, 모르는 선택은 앞으로 false 뒤로 true다", () => {
  const emptyArgs = { selection: null, selectedSlot: null, slotOrder, userImages: [] };
  assert.equal(isTabLeavingImages({ ...emptyArgs, direction: 1 }), true);
  assert.equal(isTabLeavingImages({ ...emptyArgs, direction: -1 }), true);

  assert.equal(isLeaving("unknown", null, 1), false);
  assert.equal(isLeaving("unknown", null, -1), true);
});

test("Tab: 사진 순서는 slotOrder를 따른다", () => {
  const reversedOrder = ["slot-2", "slot-1"];
  const userImages = [makeImage("a", "slot-1"), makeImage("b", "slot-2")];
  const base = { slotOrder: reversedOrder, userImages, direction: 1 as const };

  assert.equal(isTabLeavingImages({ ...base, selection: "a", selectedSlot: "slot-1" }), true);
  assert.equal(isTabLeavingImages({ ...base, selection: "b", selectedSlot: "slot-2" }), false);
});

test("가운데 기준 크기 바꾸기: 100×50을 2배 하면 x -50, y -25, scale 2가 된다", () => {
  const result = getCenterScaledTransform({
    item: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    size: { width: 100, height: 50 },
    scaleFactor: 2,
  });

  assertClose(result.x, -50, "x");
  assertClose(result.y, -25, "y");
  assertClose(result.scaleX, 2, "scaleX");
  assertClose(result.scaleY, 2, "scaleY");
});

test("가운데 기준 크기 바꾸기: 기울어진 사진도 가운데가 같고 0.1배 아래로 내려가지 않는다", () => {
  const item = { x: 10, y: 20, scaleX: 1.5, scaleY: 1.5, rotation: 30 };
  const size = { width: 80, height: 60 };

  const shrunk = getCenterScaledTransform({ item, size, scaleFactor: 1 / 1.1 });

  const before = getVisualCenter(item, size);
  const after = getVisualCenter({ ...item, x: shrunk.x, y: shrunk.y, scaleX: shrunk.scaleX, scaleY: shrunk.scaleY }, size);
  assertClose(after.x, before.x, "center x");
  assertClose(after.y, before.y, "center y");

  const smallestItem = { x: 10, y: 20, scaleX: 0.1, scaleY: 0.1, rotation: 30 };
  const clamped = getCenterScaledTransform({ item: smallestItem, size, scaleFactor: 0.5 });
  assertClose(clamped.scaleX, 0.1, "clamped scaleX");
  assertClose(clamped.scaleY, 0.1, "clamped scaleY");
  assertClose(clamped.x, 10, "clamped x");
  assertClose(clamped.y, 20, "clamped y");
});

test("캔버스 Esc: 지우기 모드면 모드만 끝낸다", () => {
  assert.equal(getCanvasEscapeAction("erase-photo"), "end-erase-mode");
});

test("캔버스 Esc: 지우기 모드가 아니면 지금처럼 선택을 푼다", () => {
  assert.equal(getCanvasEscapeAction("none"), "clear-selection");
  assert.equal(getCanvasEscapeAction("erase-cutout"), "clear-selection");
  assert.equal(getCanvasEscapeAction("pick-point"), "clear-selection");
});

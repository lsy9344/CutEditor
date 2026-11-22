import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  canvasPointToPhotoUv,
  getCutoutBrushScreenRadius,
  getRestoreClip,
  keepStickerCenter,
  stickerLocalToSourceUv,
  stickerStrokeToSourceStroke,
} from "../../src/photo/cutoutGeometry.ts";

const stickerSize = { width: 100, height: 50 };
const crop = { x: 200, y: 100, width: 400, height: 200 };
const workingSize = { width: 1000, height: 800 };

function assertClose(actual: { x: number; y: number }, expected: { x: number; y: number }): void {
  assert.ok(Math.abs(actual.x - expected.x) <= 1e-9, `x: ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= 1e-9, `y: ${actual.y} != ${expected.y}`);
}

test("keepStickerCenter keeps the center when rotation is 0", () => {
  const result = keepStickerCenter(
    { x: 100, y: 100, width: 200, height: 100, scaleX: 1, scaleY: 1, rotation: 0 },
    100,
    50,
  );

  assertClose(result, { x: 150, y: 125 });
});

test("keepStickerCenter keeps the center when rotation is 90", () => {
  const result = keepStickerCenter(
    { x: 100, y: 100, width: 200, height: 100, scaleX: 1, scaleY: 1, rotation: 90 },
    100,
    50,
  );

  assertClose(result, { x: 75, y: 150 });
});

test("keepStickerCenter applies the sticker scale", () => {
  const result = keepStickerCenter(
    { x: 10, y: 20, width: 200, height: 100, scaleX: 0.5, scaleY: 0.5, rotation: 0 },
    100,
    60,
  );

  assertClose(result, { x: 35, y: 30 });
});

test("stickerLocalToSourceUv converts a local point to source uv", () => {
  const result = stickerLocalToSourceUv({ x: 50, y: 25 }, stickerSize, crop, workingSize);

  assertClose(result, { x: 0.4, y: 0.25 });
});

test("stickerStrokeToSourceStroke converts points and the radius", () => {
  const result = stickerStrokeToSourceStroke([50, 25, 0, 0], 10, stickerSize, crop, workingSize);

  assert.deepEqual(result, {
    points: [0.4, 0.25, 0.2, 0.125],
    radius: 0.04,
  });
});

test("stickerStrokeToSourceStroke drops points outside the sticker", () => {
  const result = stickerStrokeToSourceStroke([-5, 10, 50, 25], 10, stickerSize, crop, workingSize);

  assert.deepEqual(result?.points, [0.4, 0.25]);
});

test("stickerStrokeToSourceStroke returns null when no points remain", () => {
  const result = stickerStrokeToSourceStroke([-5, 10], 10, stickerSize, crop, workingSize);

  assert.equal(result, null);
});

test("stickerStrokeToSourceStroke keeps points within reach outside the sticker", () => {
  const square = { width: 100, height: 100 };
  const squareCrop = { x: 0, y: 0, width: 100, height: 100 };
  const squareWorking = { width: 200, height: 200 };

  const reached = stickerStrokeToSourceStroke([-5, 50, -15, 50], 4, square, squareCrop, squareWorking, 10);
  assert.deepEqual(reached?.points, [-0.025, 0.25]);
  assert.equal(stickerStrokeToSourceStroke([-15, 50], 4, square, squareCrop, squareWorking, 10), null);
  assert.equal(stickerStrokeToSourceStroke([-5, 50], 4, square, squareCrop, squareWorking), null);
  assert.deepEqual(
    stickerStrokeToSourceStroke([50, 25, 0, 0], 10, stickerSize, crop, workingSize),
    { points: [0.4, 0.25, 0.2, 0.125], radius: 0.04 },
  );
});

test("keepStickerCenter keeps the center after the crop grows", () => {
  const result = keepStickerCenter(
    { x: 200, y: 150, width: 100, height: 80, scaleX: 1.5, scaleY: 1.5, rotation: 30 },
    120,
    100,
  );

  // 앞 중심 (234.9519052838329, 239.46152422706632)에서 새 반 크기(90, 75)를 30° 돌려 뺀 값
  assertClose(result, { x: 194.50961894323342, y: 129.50961894323342 });
  const centerOf = (x: number, y: number, halfWidth: number, halfHeight: number) => {
    const radians = (30 * Math.PI) / 180;
    return {
      x: x + halfWidth * Math.cos(radians) - halfHeight * Math.sin(radians),
      y: y + halfWidth * Math.sin(radians) + halfHeight * Math.cos(radians),
    };
  };
  assertClose(centerOf(result.x, result.y, 90, 75), centerOf(200, 150, 75, 60));
});

test("getRestoreClip expands the crop by the stroke radius and clamps to the photo", () => {
  const assertRectClose = (actual: { x: number; y: number; width: number; height: number }, expected: typeof actual) => {
    for (const key of ["x", "y", "width", "height"] as const) {
      assert.ok(Math.abs(actual[key] - expected[key]) <= 1e-9, `${key}: ${actual[key]} != ${expected[key]}`);
    }
  };
  const size = { width: 1000, height: 500 };

  assertRectClose(getRestoreClip({ x: 100, y: 100, width: 200, height: 100 }, size, 0.01), { x: 0.09, y: 0.18, width: 0.22, height: 0.24 });
  assertRectClose(getRestoreClip({ x: 0, y: 0, width: 50, height: 50 }, size, 0.01), { x: 0, y: 0, width: 0.06, height: 0.12 });
  assertRectClose(getRestoreClip({ x: 980, y: 480, width: 20, height: 20 }, size, 0.01), { x: 0.97, y: 0.94, width: 0.03, height: 0.06 });
});

test("getCutoutBrushScreenRadius caps the brush at 1/8 of the displayed short side", () => {
  const smallSticker = { x: 0, y: 0, width: 13.89, height: 18.99, scaleX: 1, scaleY: 1, rotation: 0 };

  assert.equal(getCutoutBrushScreenRadius(16, smallSticker, 1), 13.89 / 8);
});

test("getCutoutBrushScreenRadius keeps the default brush on a large sticker", () => {
  const largeSticker = { x: 0, y: 0, width: 300, height: 400, scaleX: 1, scaleY: 1, rotation: 0 };

  assert.equal(getCutoutBrushScreenRadius(16, largeSticker, 1), 16);
});

test("getCutoutBrushScreenRadius applies the sticker and stage scale", () => {
  const sticker = { x: 0, y: 0, width: 200, height: 100, scaleX: 0.5, scaleY: 0.5, rotation: 0 };

  assert.equal(getCutoutBrushScreenRadius(16, sticker, 1), 50 / 8);
  assert.equal(getCutoutBrushScreenRadius(16, sticker, 2), 100 / 8);
  assert.equal(getCutoutBrushScreenRadius(16, sticker, 4), 16);
});

test("getCutoutBrushScreenRadius ignores rotation and flip signs", () => {
  const sticker = { x: 0, y: 0, width: 200, height: 100, scaleX: 0.5, scaleY: -0.5, rotation: 37 };

  assert.equal(getCutoutBrushScreenRadius(16, sticker, 1), 50 / 8);
  assert.equal(getCutoutBrushScreenRadius(16, { ...sticker, scaleX: -0.5, scaleY: 0.5 }, 1), 50 / 8);
});

test("가장자리 지우기 미리보기와 실제 처리에 같은 상한 반지름을 쓴다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /strokeWidth=\{\(2 \* brushScreenRadius\) \/ stageView\.scale\}/);
  assert.match(
    source,
    /getLocalBrushRadius\(\s*getCutoutBrushScreenRadius\(requestedScreenRadius, targetSticker, zoom\),/,
  );
});

const pickSlot = { x: 100, y: 50, width: 400, height: 300 };

test("canvasPointToPhotoUv maps letterbox, offset and scale back to photo uv", () => {
  const displaySize = { width: 400, height: 200 };
  const centered = canvasPointToPhotoUv(
    { x: 300, y: 200 },
    { slot: pickSlot, displaySize, offset: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
  );
  assert.ok(centered);
  assertClose(centered, { x: 0.5, y: 0.5 });

  const movedAndScaled = canvasPointToPhotoUv(
    { x: 320, y: 190 },
    { slot: pickSlot, displaySize, offset: { x: 20, y: -10 }, scale: { x: 2, y: 2 }, rotation: 0 },
  );
  assert.ok(movedAndScaled);
  assertClose(movedAndScaled, { x: 0.25, y: 0.25 });
});

test("canvasPointToPhotoUv undoes rotation and flips", () => {
  const displaySize = { width: 400, height: 200 };
  const rotated = canvasPointToPhotoUv(
    { x: 250, y: 200 },
    { slot: pickSlot, displaySize, offset: { x: 200, y: 0 }, scale: { x: 1, y: 1 }, rotation: 90 },
  );
  assert.ok(rotated);
  assertClose(rotated, { x: 0.25, y: 0.25 });

  // 뒤집기: 사진 왼쪽 위는 칸 가운데 맞춤 위치 + 이동입니다. uv (0.5, 0.5)를 앞 방향(배율 → 회전 → 이동)으로 옮깁니다.
  const flipOffset = { x: 420, y: 110 };
  const flipScale = { x: -1, y: 1 };
  const flipRotation = 30;
  const topLeft = {
    x: pickSlot.x + (pickSlot.width - displaySize.width) / 2 + flipOffset.x,
    y: pickSlot.y + (pickSlot.height - displaySize.height) / 2 + flipOffset.y,
  };
  const scaled = { x: 0.5 * displaySize.width * flipScale.x, y: 0.5 * displaySize.height * flipScale.y };
  const radians = (flipRotation * Math.PI) / 180;
  const forwardPoint = {
    x: topLeft.x + scaled.x * Math.cos(radians) - scaled.y * Math.sin(radians),
    y: topLeft.y + scaled.x * Math.sin(radians) + scaled.y * Math.cos(radians),
  };
  assert.ok(Math.abs(forwardPoint.x - 296.795) < 1e-3 && Math.abs(forwardPoint.y - 196.603) < 1e-3);
  assert.ok(
    forwardPoint.x >= pickSlot.x &&
      forwardPoint.x <= pickSlot.x + pickSlot.width &&
      forwardPoint.y >= pickSlot.y &&
      forwardPoint.y <= pickSlot.y + pickSlot.height,
  );

  const flipped = canvasPointToPhotoUv(forwardPoint, {
    slot: pickSlot,
    displaySize,
    offset: flipOffset,
    scale: flipScale,
    rotation: flipRotation,
  });
  assert.ok(flipped);
  assertClose(flipped, { x: 0.5, y: 0.5 });
});

test("canvasPointToPhotoUv returns null outside the slot or photo, and ignores the sticker crop", () => {
  const placement = {
    slot: pickSlot,
    displaySize: { width: 400, height: 800 / 3 },
    offset: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
  };
  const circleCenter = canvasPointToPhotoUv({ x: 422.222, y: 200 }, placement);
  assert.ok(circleCenter);
  assert.ok(Math.abs(circleCenter.x - 0.80556) <= 1e-4, `x: ${circleCenter.x}`);
  assert.ok(Math.abs(circleCenter.y - 0.5) <= 1e-4, `y: ${circleCenter.y}`);

  assert.equal(canvasPointToPhotoUv({ x: 90, y: 200 }, placement), null);
  assert.equal(canvasPointToPhotoUv({ x: 300, y: 60 }, placement), null);
});

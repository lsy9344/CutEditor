import test from "node:test";
import assert from "node:assert/strict";

import { getEraseZoomView } from "../../src/canvas/zoomSizing.ts";

const TOLERANCE = 1e-6;
const assertClose = (actual: number, expected: number, label: string) => {
  assert.ok(Math.abs(actual - expected) < TOLERANCE, `${label}: ${actual} != ${expected}`);
};

type StageViewResult = { scale: number; x: number; y: number };
const assertView = (view: StageViewResult, expected: StageViewResult, label: string) => {
  assertClose(view.scale, expected.scale, `${label} scale`);
  assertClose(view.x, expected.x, `${label} x`);
  assertClose(view.y, expected.y, `${label} y`);
};

const BASE_ARGS = {
  isErasing: true,
  stageWidth: 600,
  stageHeight: 900,
  zoom: 0.5,
  slot: { x: 100, y: 200, width: 400, height: 300 },
};
const FIT_VIEW = { scale: 0.5, x: 0, y: 0 };

test("지우기가 아니면 Stage 보기는 화면 맞춤 그대로다", () => {
  assertView(getEraseZoomView({ ...BASE_ARGS, isErasing: false }), FIT_VIEW, "지우기 아님");
  assertView(getEraseZoomView({ ...BASE_ARGS, slot: null }), FIT_VIEW, "칸 없음");
});

test("고른 칸이 Stage 가장자리에서 16px 안쪽에 꽉 차게 확대한다", () => {
  const view = getEraseZoomView(BASE_ARGS);

  assertView(view, { scale: 1.42, x: -126, y: -47 }, "확대");
  assertClose(view.x + 100 * view.scale, 16, "칸 왼쪽 화면 x");
  assertClose(view.x + 500 * view.scale, 584, "칸 오른쪽 화면 x");
});

test("확대 비율은 4배에서 멈춘다", () => {
  const view = getEraseZoomView({ ...BASE_ARGS, slot: { x: 0, y: 0, width: 100, height: 100 } });

  assertView(view, { scale: 2, x: 200, y: 350 }, "4배");
});

test("1.25배보다 작게 커지면 확대하지 않는다", () => {
  const view = getEraseZoomView({ ...BASE_ARGS, slot: { x: 0, y: 0, width: 1200, height: 1800 } });

  assertView(view, FIT_VIEW, "작은 확대");
});

test("작은 Stage에서는 가장자리 여백을 짧은 변의 5%로 줄인다", () => {
  const view = getEraseZoomView({
    isErasing: true,
    stageWidth: 200,
    stageHeight: 300,
    zoom: 0.25,
    slot: { x: 0, y: 0, width: 200, height: 300 },
  });

  assertView(view, { scale: 0.9, x: 10, y: 15 }, "작은 Stage");
});

test("크기나 위치가 유한하지 않거나 0 이하면 확대하지 않는다", () => {
  assertView(getEraseZoomView({ ...BASE_ARGS, stageWidth: 0 }), FIT_VIEW, "Stage 폭 0");
  assertView(getEraseZoomView({ ...BASE_ARGS, slot: { ...BASE_ARGS.slot, width: -1 } }), FIT_VIEW, "칸 폭 음수");
  assertView(getEraseZoomView({ ...BASE_ARGS, slot: { ...BASE_ARGS.slot, x: Number.NaN } }), FIT_VIEW, "칸 x NaN");
});

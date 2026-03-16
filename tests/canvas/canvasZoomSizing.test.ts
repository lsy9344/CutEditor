import { getZoomToFit } from "../../src/canvas/zoomSizing.ts";

function assertEqual(actual: number, expected: number, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

const zoom = getZoomToFit({
  containerWidth: 1072,
  containerHeight: 1182,
  canvasWidth: 720,
  canvasHeight: 480,
  padding: 48,
  minZoom: 0.1,
  maxZoom: 2,
});

assertEqual(
  zoom,
  1.4222,
  "2컷 가로 프레임은 실제 캔버스 영역 너비에 맞게 zoom이 계산되어야 한다",
);

const mobileZoom = getZoomToFit({
  containerWidth: 400,
  containerHeight: 360,
  canvasWidth: 480,
  canvasHeight: 720,
  padding: 48,
  minZoom: 0.1,
  maxZoom: 2,
  fitMode: "width",
});

assertEqual(
  mobileZoom,
  0.7333,
  "모바일 편집 모드에서는 캔버스가 지나치게 작아지지 않도록 너비 우선 zoom을 사용해야 한다",
);

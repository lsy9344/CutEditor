import test from "node:test";
import assert from "node:assert/strict";

import { getAutoFitZoomChange } from "../../src/canvas/zoomSizing.ts";

// UX5-1: 저장하는 동안에는 컨테이너 크기가 바뀌어도 Stage 배율을 바꾸지 않고, 끝난 뒤 한 번 맞춥니다.
test("저장 중에는 맞춤 배율이 현재와 달라도 바꾸지 않는다", () => {
  assert.equal(getAutoFitZoomChange({ isSaving: true, currentZoom: 1, fittedZoom: 0.2938 }), null);
});

test("저장이 끝나면 그동안 들어온 최신 컨테이너 크기의 맞춤 배율을 한 번 적용한다", () => {
  assert.equal(getAutoFitZoomChange({ isSaving: false, currentZoom: 1, fittedZoom: 0.2938 }), 0.2938);
});

test("저장 중이 아니어도 배율 차이가 0.005 이하면 바꾸지 않는다", () => {
  assert.equal(getAutoFitZoomChange({ isSaving: false, currentZoom: 1, fittedZoom: 1.005 }), null);
  assert.equal(getAutoFitZoomChange({ isSaving: false, currentZoom: 1, fittedZoom: 1.006 }), 1.006);
});

import {
  getSaveStrategy,
  getExportRenderPlan,
} from "../../src/utils/exportBehavior.js";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertApproxEqual(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

assertEqual(
  getSaveStrategy({
    hasFilePicker: true,
    prefersTouchExperience: true,
  }),
  "download",
  "터치 기반 환경에서는 파일 선택창 대신 다운로드를 우선해야 한다",
);

assertEqual(
  getSaveStrategy({
    hasFilePicker: false,
    prefersTouchExperience: true,
  }),
  "download",
  "터치 기반 환경에서 파일 선택창이 없어도 다운로드를 유지해야 한다",
);

assertEqual(
  getSaveStrategy({
    hasFilePicker: true,
    prefersTouchExperience: false,
  }),
  "save-file-picker",
  "desktop 성격 환경에서는 파일 저장 위치 선택을 우선해야 한다",
);

assertEqual(
  getSaveStrategy({
    hasFilePicker: false,
    prefersTouchExperience: false,
  }),
  "download",
  "사용 가능한 저장 API가 없으면 다운로드로 폴백해야 한다",
);

const verticalPlan = getExportRenderPlan({
  frameType: "4v_1",
  logicalCanvasWidth: 480,
  logicalCanvasHeight: 720,
  fallbackMaxWidthPx: 3072,
});

assertEqual(
  verticalPlan.targetWidthPx,
  4724,
  "세로 프레임은 10cm 기준 목표 폭을 사용해야 한다",
);

assertApproxEqual(
  verticalPlan.initialPixelRatio,
  9.8417,
  "화면 줌이 아닌 논리 캔버스 폭으로 pixelRatio를 계산해야 한다",
);

assertApproxEqual(
  verticalPlan.fallbackPixelRatio ?? 0,
  6.4,
  "모바일 폴백은 3072px 기준으로 한 번만 낮춰야 한다",
);

const horizontalPlan = getExportRenderPlan({
  frameType: "2h",
  logicalCanvasWidth: 720,
  logicalCanvasHeight: 480,
  fallbackMaxWidthPx: 3072,
});

assertEqual(
  horizontalPlan.targetWidthPx,
  7087,
  "가로 프레임은 15cm 기준 목표 폭을 사용해야 한다",
);

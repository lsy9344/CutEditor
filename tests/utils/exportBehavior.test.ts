import {
  getExportExperience,
  getMobileExportLimits,
  getMobileSaveFallback,
  isShareAbortError,
  getExportRenderPlan,
  shouldShowManualSaveHintImmediately,
} from "../../src/utils/exportBehavior.ts";

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
  getExportExperience({
    hasShareFiles: true,
    hasFilePicker: true,
    prefersTouchExperience: true,
  }),
  "share-sheet",
  "coarse pointer 환경에서는 공유 시트를 우선해야 한다",
);

assertEqual(
  getExportExperience({
    hasShareFiles: false,
    hasFilePicker: false,
    prefersTouchExperience: true,
  }),
  "share-sheet",
  "터치 환경에서는 공유 가능 여부와 관계없이 모바일 저장 시트를 유지해야 한다",
);

assertEqual(
  getExportExperience({
    hasShareFiles: false,
    hasFilePicker: true,
    prefersTouchExperience: false,
  }),
  "save-file-picker",
  "desktop 성격 환경에서는 파일 저장 위치 선택을 우선해야 한다",
);

assertEqual(
  getExportExperience({
    hasShareFiles: false,
    hasFilePicker: false,
    prefersTouchExperience: false,
  }),
  "download",
  "사용 가능한 저장 API가 없으면 다운로드로 폴백해야 한다",
);

assertEqual(
  getMobileSaveFallback({
    userAgent: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921N) AppleWebKit/537.36 SamsungBrowser/24.0 Chrome/120.0 Mobile Safari/537.36",
    isStandalone: false,
  }),
  "manual-preview",
  "안드로이드 계열 모바일 브라우저는 자동 다운로드 대신 수동 미리보기를 우선해야 한다",
);

assertEqual(
  getMobileSaveFallback({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    isStandalone: true,
  }),
  "manual-preview",
  "설치형 웹앱에서는 새 탭 이동 대신 현재 화면 미리보기를 유지해야 한다",
);

assertEqual(
  getMobileSaveFallback({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    isStandalone: false,
  }),
  "manual-preview",
  "iPhone Safari도 blob 다운로드 대신 현재 화면의 수동 미리보기를 우선해야 한다",
);

assertEqual(
  shouldShowManualSaveHintImmediately({
    userAgent: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921N) AppleWebKit/537.36 SamsungBrowser/24.0 Chrome/120.0 Mobile Safari/537.36",
    isStandalone: false,
  }),
  true,
  "갤럭시 계열 모바일 브라우저는 저장 시트가 열릴 때 즉시 수동 저장 안내를 보여야 한다",
);

assertEqual(
  shouldShowManualSaveHintImmediately({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    isStandalone: false,
  }),
  false,
  "iPhone Safari는 저장 시트 진입 직후에는 공유 저장 흐름을 유지할 수 있어야 한다",
);

const iosMobileExportLimits = getMobileExportLimits({
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
});

assertEqual(
  iosMobileExportLimits.initialMaxWidthPx,
  2048,
  "iPhone Safari는 초기 내보내기 폭을 더 낮게 시작해야 한다",
);

assertEqual(
  iosMobileExportLimits.fallbackMaxWidthPx,
  1536,
  "iPhone Safari는 실패 시 더 낮은 폭으로 한 번 더 폴백해야 한다",
);

const androidMobileExportLimits = getMobileExportLimits({
  userAgent: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921N) AppleWebKit/537.36 SamsungBrowser/24.0 Chrome/120.0 Mobile Safari/537.36",
});

assertEqual(
  androidMobileExportLimits.initialMaxWidthPx,
  3072,
  "안드로이드 계열 모바일 브라우저는 기존 초기 해상도 상한을 유지해야 한다",
);

assertEqual(
  androidMobileExportLimits.fallbackMaxWidthPx,
  2048,
  "안드로이드 계열 모바일 브라우저는 기존 폴백 해상도 상한을 유지해야 한다",
);

assertEqual(
  isShareAbortError(new DOMException("cancelled", "AbortError")),
  true,
  "공유 시트 취소는 AbortError로 식별해야 한다",
);

assertEqual(
  isShareAbortError(new Error("share failed")),
  false,
  "일반 공유 실패는 취소와 구분해야 한다",
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
  "기본 폴백은 3072px 기준으로 한 번만 낮춰야 한다",
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

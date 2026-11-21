type GetZoomToFitArgs = {
  containerWidth: number;
  containerHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
  fitMode?: "contain" | "width";
};

export function getZoomToFit({
  containerWidth,
  containerHeight,
  canvasWidth,
  canvasHeight,
  padding = 48,
  minZoom = 0.1,
  maxZoom = 2,
  fitMode = "contain",
}: GetZoomToFitArgs): number {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    !Number.isFinite(canvasWidth) ||
    !Number.isFinite(canvasHeight) ||
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    canvasWidth <= 0 ||
    canvasHeight <= 0
  ) {
    return minZoom;
  }

  const availableWidth = Math.max(100, containerWidth - padding);
  const availableHeight = Math.max(100, containerHeight - padding);
  const ratioX = availableWidth / canvasWidth;
  const ratioY = availableHeight / canvasHeight;
  const ratio = fitMode === "width" ? ratioX : Math.min(ratioX, ratioY);

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return minZoom;
  }

  return Math.max(minZoom, Math.min(maxZoom, Number(ratio.toFixed(4))));
}

const AUTO_FIT_ZOOM_TOLERANCE = 0.005;

// 컨테이너 크기에 맞춘 배율을 Stage에 적용할지 정합니다. 적용할 배율을 돌려주고, 바꾸지 않으면 null입니다.
// 저장하는 동안에는 렌더가 Stage 크기·배율을 계획 값으로 맞춰 두므로 바꾸지 않고, 끝난 뒤 최신 컨테이너 크기로 한 번 맞춥니다(UX5-1).
export function getAutoFitZoomChange({
  isSaving,
  currentZoom,
  fittedZoom,
}: {
  isSaving: boolean;
  currentZoom: number;
  fittedZoom: number;
}): number | null {
  if (isSaving) return null;
  return Math.abs(fittedZoom - currentZoom) > AUTO_FIT_ZOOM_TOLERANCE ? fittedZoom : null;
}

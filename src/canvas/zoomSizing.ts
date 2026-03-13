type GetZoomToFitArgs = {
  containerWidth: number;
  containerHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
};

export function getZoomToFit({
  containerWidth,
  containerHeight,
  canvasWidth,
  canvasHeight,
  padding = 48,
  minZoom = 0.1,
  maxZoom = 2,
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
  const ratio = Math.min(ratioX, ratioY);

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return minZoom;
  }

  return Math.max(minZoom, Math.min(maxZoom, Number(ratio.toFixed(4))));
}

import type { FrameType } from "../types/frame";

export type SaveStrategy = "save-file-picker" | "download";

type SaveStrategyArgs = {
  hasFilePicker: boolean;
  prefersTouchExperience: boolean;
};

type ExportRenderPlanArgs = {
  frameType: FrameType;
  logicalCanvasWidth: number;
  logicalCanvasHeight: number;
  targetDpi?: number;
  fallbackMaxWidthPx?: number;
};

type ExportRenderPlan = {
  targetWidthPx: number;
  targetHeightPx: number;
  initialPixelRatio: number;
  fallbackPixelRatio: number | null;
};

const DEFAULT_TARGET_DPI = 1200;
const DEFAULT_FALLBACK_MAX_WIDTH = 3072;

const cmToPx = (cm: number, dpi: number): number => Math.round((cm * dpi) / 2.54);

export function getSaveStrategy({
  hasFilePicker,
  prefersTouchExperience,
}: SaveStrategyArgs): SaveStrategy {
  if (!prefersTouchExperience && hasFilePicker) {
    return "save-file-picker";
  }

  return "download";
}

export function getExportRenderPlan({
  frameType,
  logicalCanvasWidth,
  logicalCanvasHeight,
  targetDpi = DEFAULT_TARGET_DPI,
  fallbackMaxWidthPx = DEFAULT_FALLBACK_MAX_WIDTH,
}: ExportRenderPlanArgs): ExportRenderPlan {
  const isHorizontal = /h$/i.test(frameType);
  const targetWidthPx = cmToPx(isHorizontal ? 15 : 10, targetDpi);
  const aspectRatio = logicalCanvasHeight / logicalCanvasWidth;
  const targetHeightPx = Math.round(targetWidthPx * aspectRatio);
  const initialPixelRatio = Number((targetWidthPx / logicalCanvasWidth).toFixed(4));

  const fallbackWidthPx = Math.min(targetWidthPx, fallbackMaxWidthPx);
  const fallbackPixelRatio = fallbackWidthPx < targetWidthPx
    ? Number((fallbackWidthPx / logicalCanvasWidth).toFixed(4))
    : null;

  return {
    targetWidthPx,
    targetHeightPx,
    initialPixelRatio,
    fallbackPixelRatio,
  };
}

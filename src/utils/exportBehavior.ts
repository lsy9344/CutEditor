import type { FrameType } from "../types/frame";

export type ExportExperience = "share-sheet" | "save-file-picker" | "download";
export type MobileSaveFallback = "manual-preview" | "download";

type ExportExperienceArgs = {
  hasShareFiles: boolean;
  hasFilePicker: boolean;
  prefersTouchExperience: boolean;
};

type ExportRenderPlanArgs = {
  frameType: FrameType;
  logicalCanvasWidth: number;
  logicalCanvasHeight: number;
  targetDpi?: number;
  initialMaxWidthPx?: number;
  fallbackMaxWidthPx?: number;
};

type MobileSaveFallbackArgs = {
  userAgent?: string;
  isStandalone: boolean;
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

export function getExportExperience({
  hasShareFiles,
  hasFilePicker,
  prefersTouchExperience,
}: ExportExperienceArgs): ExportExperience {
  if (prefersTouchExperience) {
    return "share-sheet";
  }

  if (hasFilePicker && !prefersTouchExperience) {
    return "save-file-picker";
  }

  if (hasShareFiles) {
    return "share-sheet";
  }

  if (hasFilePicker) {
    return "save-file-picker";
  }

  return "download";
}

export function getExportRenderPlan({
  frameType,
  logicalCanvasWidth,
  logicalCanvasHeight,
  targetDpi = DEFAULT_TARGET_DPI,
  initialMaxWidthPx,
  fallbackMaxWidthPx = DEFAULT_FALLBACK_MAX_WIDTH,
}: ExportRenderPlanArgs): ExportRenderPlan {
  const isHorizontal = /h$/i.test(frameType);
  const targetWidthPx = cmToPx(isHorizontal ? 15 : 10, targetDpi);
  const aspectRatio = logicalCanvasHeight / logicalCanvasWidth;
  const targetHeightPx = Math.round(targetWidthPx * aspectRatio);
  const initialWidthPx = Math.min(targetWidthPx, initialMaxWidthPx ?? targetWidthPx);
  const initialPixelRatio = Number((initialWidthPx / logicalCanvasWidth).toFixed(4));

  const fallbackWidthPx = Math.min(initialWidthPx, fallbackMaxWidthPx);
  const fallbackPixelRatio = fallbackWidthPx < initialWidthPx
    ? Number((fallbackWidthPx / logicalCanvasWidth).toFixed(4))
    : null;

  return {
    targetWidthPx,
    targetHeightPx,
    initialPixelRatio,
    fallbackPixelRatio,
  };
}

export function getMobileSaveFallback({
  userAgent = "",
  isStandalone,
}: MobileSaveFallbackArgs): MobileSaveFallback {
  if (isStandalone) {
    return "manual-preview";
  }

  const normalizedUserAgent = userAgent.toLowerCase();
  const isAndroidLikeBrowser = normalizedUserAgent.includes("android")
    || normalizedUserAgent.includes("samsungbrowser");
  const isIosLikeBrowser = normalizedUserAgent.includes("iphone")
    || normalizedUserAgent.includes("ipad")
    || normalizedUserAgent.includes("ipod")
    || (normalizedUserAgent.includes("macintosh") && normalizedUserAgent.includes("mobile"));

  if (isAndroidLikeBrowser || isIosLikeBrowser) {
    return "manual-preview";
  }

  return "download";
}

export function isShareAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

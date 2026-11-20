import type { BrushStroke, PhotoAdjust } from "./photoEdits.ts";
import { applyPhotoAdjust } from "./photoAdjust.ts";
import { rasterizeStroke } from "./brushMask.ts";
import { inpaintMasked } from "./inpaint.ts";

export const PHOTO_WORKING_MAX_SIDE = { desktop: 4096, mobile: 2048 } as const;

const MIN_WORKING_SIDE = 1;

// 작업 크기의 짧은 변이 1px로 잘려야 하는 극단 비율인지 판정한다.
// 이런 사진은 작업 캔버스를 제대로 만들 수 없으므로 렌더 실패로 다룬다.
export function isPhotoWorkingSizeClamped(
  naturalWidth: number,
  naturalHeight: number,
  maxSide: number,
): boolean {
  const longSide = Math.max(naturalWidth, naturalHeight);

  if (longSide <= maxSide) return false;

  const shortSide = Math.min(naturalWidth, naturalHeight);
  return Math.round((shortSide * maxSide) / longSide) < MIN_WORKING_SIDE;
}

export function getWorkingSize(
  naturalWidth: number,
  naturalHeight: number,
  maxSide: number,
): { width: number; height: number } {
  const longSide = Math.max(naturalWidth, naturalHeight);

  if (longSide <= maxSide) {
    return {
      width: Math.max(MIN_WORKING_SIDE, naturalWidth),
      height: Math.max(MIN_WORKING_SIDE, naturalHeight),
    };
  }

  if (naturalWidth >= naturalHeight) {
    return {
      width: maxSide,
      height: Math.max(MIN_WORKING_SIDE, Math.round((naturalHeight * maxSide) / naturalWidth)),
    };
  }

  return {
    width: Math.max(MIN_WORKING_SIDE, Math.round((naturalWidth * maxSide) / naturalHeight)),
    height: maxSide,
  };
}

function getSourceSize(source: HTMLImageElement | HTMLCanvasElement): {
  width: number;
  height: number;
} {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  return { width: source.width, height: source.height };
}

export function applyEraseStrokes(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  strokes: BrushStroke[],
): void {
  const mask = new Uint8Array(width * height);
  strokes.forEach((stroke) => rasterizeStroke(stroke, width, height, mask));
  inpaintMasked(rgba, width, height, mask);
}

export function renderPhotoBase(
  source: HTMLImageElement | HTMLCanvasElement,
  erase: BrushStroke[],
  maxSide: number,
): HTMLCanvasElement {
  const sourceSize = getSourceSize(source);
  const workingSize = getWorkingSize(sourceSize.width, sourceSize.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = workingSize.width;
  canvas.height = workingSize.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D 캔버스 컨텍스트를 만들 수 없습니다");
  }

  context.drawImage(source, 0, 0, workingSize.width, workingSize.height);

  if (erase.length > 0) {
    const imageData = context.getImageData(0, 0, workingSize.width, workingSize.height);
    applyEraseStrokes(imageData.data, workingSize.width, workingSize.height, erase);
    context.putImageData(imageData, 0, 0);
  }

  return canvas;
}

export function renderAdjustedPhoto(
  base: HTMLCanvasElement,
  adjust: PhotoAdjust,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = base.width;
  canvas.height = base.height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("2D 캔버스 컨텍스트를 만들 수 없습니다");
  }

  context.drawImage(base, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyPhotoAdjust(imageData.data, adjust);
  context.putImageData(imageData, 0, 0);

  return canvas;
}

import type { BrushStroke, PhotoAdjust } from "./photoEdits.ts";
import { applyPhotoAdjust } from "./photoAdjust.ts";

export const PHOTO_WORKING_MAX_SIDE = { desktop: 4096, mobile: 2048 } as const;

export function getWorkingSize(
  naturalWidth: number,
  naturalHeight: number,
  maxSide: number,
): { width: number; height: number } {
  const longSide = Math.max(naturalWidth, naturalHeight);

  if (longSide <= maxSide) {
    return { width: naturalWidth, height: naturalHeight };
  }

  if (naturalWidth >= naturalHeight) {
    return {
      width: maxSide,
      height: Math.round((naturalHeight * maxSide) / naturalWidth),
    };
  }

  return {
    width: Math.round((naturalWidth * maxSide) / naturalHeight),
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

export function renderPhotoBase(
  source: HTMLImageElement | HTMLCanvasElement,
  erase: BrushStroke[],
  maxSide: number,
): HTMLCanvasElement {
  // Phase 2에서는 지우기 획을 아직 적용하지 않습니다.
  void erase;

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

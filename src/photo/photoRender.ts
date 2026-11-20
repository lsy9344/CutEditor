import type { BrushStroke, PhotoAdjust } from "./photoEdits.ts";
import { applyPhotoAdjust } from "./photoAdjust.ts";
import { rasterizeStroke } from "./brushMask.ts";
import { INPAINT_PADDING, inpaintMasked } from "./inpaint.ts";

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
    const mask = new Uint8Array(workingSize.width * workingSize.height);
    erase.forEach((stroke) => rasterizeStroke(stroke, workingSize.width, workingSize.height, mask));
    inpaintMasked(imageData.data, workingSize.width, workingSize.height, mask);
    context.putImageData(imageData, 0, 0);
  }

  return canvas;
}

type StrokeBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function getStrokeBounds(stroke: BrushStroke, width: number, height: number): StrokeBounds | null {
  if (stroke.points.length < 2) return null;

  const radius = stroke.radius * width;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index + 1 < stroke.points.length; index += 2) {
    const x = stroke.points[index] * width;
    const y = stroke.points[index + 1] * height;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    minX: Math.max(0, Math.floor(minX - radius)),
    minY: Math.max(0, Math.floor(minY - radius)),
    maxX: Math.min(width - 1, Math.ceil(maxX + radius)),
    maxY: Math.min(height - 1, Math.ceil(maxY + radius)),
  };
}

// 새 획의 메움 영역이 이전 획들의 메움 영역과 겹치지 않는지 확인한다.
// 겹치지 않으면 이전 지우기 결과 위에 새 획만 메워도 같은 픽셀이 된다.
export function isStrokeSeparatedFromStrokes(
  stroke: BrushStroke,
  previousStrokes: BrushStroke[],
  width: number,
  height: number,
): boolean {
  const bounds = getStrokeBounds(stroke, width, height);
  if (!bounds) return false;

  for (const previous of previousStrokes) {
    const previousBounds = getStrokeBounds(previous, width, height);
    if (!previousBounds) continue;
    const separated = bounds.minX - previousBounds.maxX > INPAINT_PADDING
      || previousBounds.minX - bounds.maxX > INPAINT_PADDING
      || bounds.minY - previousBounds.maxY > INPAINT_PADDING
      || previousBounds.minY - bounds.maxY > INPAINT_PADDING;
    if (!separated) return false;
  }

  return true;
}

// 이전 지우기 결과를 복사한 뒤 새 획 하나만 메운다.
export function renderBrushStrokeOnBase(
  base: HTMLCanvasElement,
  stroke: BrushStroke,
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
  const mask = new Uint8Array(canvas.width * canvas.height);
  rasterizeStroke(stroke, canvas.width, canvas.height, mask);
  inpaintMasked(imageData.data, canvas.width, canvas.height, mask);
  context.putImageData(imageData, 0, 0);

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

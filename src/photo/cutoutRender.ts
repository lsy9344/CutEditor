import type { BrushStroke, PhotoEdits } from "./photoEdits.ts";
import type { CutoutRect, CutoutSize } from "./cutoutTypes.ts";
import {
  buildCutoutAlpha,
  buildOutlineAlpha,
  composeCutoutRgba,
  cropChannel,
  findAlphaBounds,
  getOutlineRadius,
} from "./cutoutMask.ts";
import { renderAdjustedPhoto, renderPhotoBase } from "./photoRender.ts";

export const CUTOUT_WORKING_MAX_SIDE = 2048;

// 모델 추론과 테두리 계산은 동기 작업이라, 그 전에 이 함수를 기다리면
// '만드는 중' 문구가 먼저 화면에 그려집니다(설계 5.4).
export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다"));
    image.src = url;
  });
}

// 만드는 순간의 보정과 지우기를 반영한 작업 캔버스를 만듭니다(U16).
export function createCutoutWorkingCanvas(
  source: HTMLImageElement,
  edits: PhotoEdits,
): HTMLCanvasElement {
  const base = renderPhotoBase(source, edits.erase, CUTOUT_WORKING_MAX_SIDE);
  return renderAdjustedPhoto(base, edits.adjust);
}

export type CutoutRenderResult =
  | {
      kind: "ok";
      url: string;
      width: number;
      height: number;
      crop: CutoutRect;
      workingSize: CutoutSize;
    }
  | { kind: "not-found" };

export async function renderCutoutSticker(
  workingCanvas: HTMLCanvasElement,
  confidence: Float32Array,
  options: { outline: boolean; eraseStrokes: BrushStroke[] },
): Promise<CutoutRenderResult> {
  const workingWidth = workingCanvas.width;
  const workingHeight = workingCanvas.height;
  const context = workingCanvas.getContext("2d");

  if (!context) {
    throw new Error("2D 캔버스 컨텍스트를 만들 수 없습니다");
  }

  const fullPixels = context.getImageData(0, 0, workingWidth, workingHeight);
  const alpha = buildCutoutAlpha(
    confidence,
    fullPixels.data,
    workingWidth,
    workingHeight,
    options.eraseStrokes,
  );
  if (!alpha) return { kind: "not-found" };

  const tight = findAlphaBounds(alpha, workingWidth, workingHeight, 0);
  if (!tight) return { kind: "not-found" };

  const radius = getOutlineRadius(tight.width, tight.height);
  const crop = findAlphaBounds(
    alpha,
    workingWidth,
    workingHeight,
    options.outline ? radius + 2 : 2,
  );
  if (!crop) return { kind: "not-found" };

  const photoPixels = context.getImageData(crop.x, crop.y, crop.width, crop.height);
  const croppedAlpha = cropChannel(alpha, workingWidth, crop);
  const outlineAlpha = options.outline
    ? buildOutlineAlpha(croppedAlpha, crop.width, crop.height, radius)
    : null;
  const rgba = composeCutoutRgba(photoPixels.data, croppedAlpha, outlineAlpha);

  const stickerCanvas = document.createElement("canvas");
  stickerCanvas.width = crop.width;
  stickerCanvas.height = crop.height;
  const stickerContext = stickerCanvas.getContext("2d");

  if (!stickerContext) {
    throw new Error("2D 캔버스 컨텍스트를 만들 수 없습니다");
  }

  const imageData = stickerContext.createImageData(crop.width, crop.height);
  imageData.data.set(rgba);
  stickerContext.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => {
    stickerCanvas.toBlob(resolve, "image/png");
  });

  if (!blob) {
    throw new Error("스티커 PNG를 만들지 못했습니다");
  }

  // URL은 마지막 단계에서만 만듭니다. 그 뒤에는 이 함수가 오류로 끝나지 않습니다.
  const url = URL.createObjectURL(blob);
  return {
    kind: "ok",
    url,
    width: crop.width,
    height: crop.height,
    crop,
    workingSize: { width: workingWidth, height: workingHeight },
  };
}

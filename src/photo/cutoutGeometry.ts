import type { BrushStroke } from "./photoEdits.ts";
import type { CutoutRect, CutoutSize } from "./cutoutTypes.ts";

export type StickerFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

function rotate(vector: { x: number; y: number }, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

export function keepStickerCenter(
  sticker: StickerFrame,
  newWidth: number,
  newHeight: number,
): { x: number; y: number } {
  const radians = (sticker.rotation * Math.PI) / 180;
  const halfWidth = (sticker.width * sticker.scaleX) / 2;
  const halfHeight = (sticker.height * sticker.scaleY) / 2;
  const offset = rotate({ x: halfWidth, y: halfHeight }, radians);
  const center = { x: sticker.x + offset.x, y: sticker.y + offset.y };
  const newOffset = rotate(
    { x: (newWidth * sticker.scaleX) / 2, y: (newHeight * sticker.scaleY) / 2 },
    radians,
  );

  return { x: center.x - newOffset.x, y: center.y - newOffset.y };
}

export function stickerLocalToSourceUv(
  local: { x: number; y: number },
  stickerSize: CutoutSize,
  crop: CutoutRect,
  workingSize: CutoutSize,
): { x: number; y: number } {
  return {
    x: (crop.x + (local.x / stickerSize.width) * crop.width) / workingSize.width,
    y: (crop.y + (local.y / stickerSize.height) * crop.height) / workingSize.height,
  };
}

export function stickerStrokeToSourceStroke(
  localPoints: number[],
  localRadius: number,
  stickerSize: CutoutSize,
  crop: CutoutRect,
  workingSize: CutoutSize,
): BrushStroke | null {
  const points: number[] = [];

  for (let index = 0; index + 1 < localPoints.length; index += 2) {
    const x = localPoints[index];
    const y = localPoints[index + 1];
    if (x < 0 || x > stickerSize.width || y < 0 || y > stickerSize.height) continue;

    const uv = stickerLocalToSourceUv({ x, y }, stickerSize, crop, workingSize);
    points.push(uv.x, uv.y);
  }

  if (points.length === 0) return null;

  return {
    points,
    radius: (localRadius * (crop.width / stickerSize.width)) / workingSize.width,
  };
}

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

// 칸 사진이 캔버스에 놓인 모양입니다(CanvasStage 칸 사진 그리기와 같음, 설계 4.4).
export type PhotoPlacement = {
  slot: CutoutRect; // 프레임 칸(캔버스 좌표)
  displaySize: CutoutSize; // getContainedImageSize 결과
  offset: { x: number; y: number }; // userImage.x / y
  scale: { x: number; y: number }; // userImage.scaleX / scaleY (음수면 뒤집기)
  rotation: number; // 도. Konva 기본처럼 사진 왼쪽 위가 회전 중심
};

// 캔버스 점을 사진 전체 0~1 좌표로 바꿉니다. 칸 밖(잘려 안 보이는 곳)과 칸 안의 빈 여백은 null입니다.
// 작업 캔버스가 사진 전체를 비율 그대로 담으므로 스티커 crop은 들어가지 않습니다(설계 4.4).
export function canvasPointToPhotoUv(
  point: { x: number; y: number },
  placement: PhotoPlacement,
): { x: number; y: number } | null {
  const { slot, displaySize, offset, scale, rotation } = placement;
  if (point.x < slot.x || point.x > slot.x + slot.width || point.y < slot.y || point.y > slot.y + slot.height) {
    return null;
  }

  const topLeft = {
    x: slot.x + (slot.width - displaySize.width) / 2 + offset.x,
    y: slot.y + (slot.height - displaySize.height) / 2 + offset.y,
  };
  const unrotated = rotate({ x: point.x - topLeft.x, y: point.y - topLeft.y }, (-rotation * Math.PI) / 180);
  const u = unrotated.x / scale.x / displaySize.width;
  const v = unrotated.y / scale.y / displaySize.height;
  if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return null;

  return { x: u, y: v };
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

// 작은 스티커에서 기본 붓 한 획이 남은 전경을 모두 덮지 않도록,
// 화면에 보이는 스티커 짧은 변의 1/8을 넘지 않게 붓 반지름을 제한합니다.
export function getCutoutBrushScreenRadius(
  screenRadius: number,
  sticker: StickerFrame,
  stageScale: number,
): number {
  const displayedShortSide = Math.min(
    sticker.width * Math.abs(sticker.scaleX),
    sticker.height * Math.abs(sticker.scaleY),
  ) * stageScale;
  return Math.min(screenRadius, displayedShortSide / 8);
}

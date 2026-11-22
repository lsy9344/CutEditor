import type { BrushStroke } from "./photoEdits.ts";

export type PhotoToolMode = "none" | "erase-photo" | "erase-cutout" | "pick-point";
export type BrushSize = "small" | "medium" | "large";

export const BRUSH_SCREEN_RADIUS: Record<BrushSize, number> = {
  small: 8,
  medium: 16,
  large: 28,
};

export const BRUSH_SIZE_OPTIONS: { size: BrushSize; label: string }[] = [
  { size: "small", label: "작게" },
  { size: "medium", label: "보통" },
  { size: "large", label: "크게" },
];

export const ERASE_PREVIEW_COLOR = "rgba(255,107,53,0.5)";

export function getLocalBrushRadius(screenRadius: number, absoluteScaleX: number): number {
  return screenRadius / Math.abs(absoluteScaleX);
}

export function isBrushPointerStart(pointerType: string, isPrimary: boolean, button: number): boolean {
  if (!isPrimary) return false;
  return pointerType !== "mouse" || button === 0;
}

export function toNormalizedStroke(
  localPoints: number[],
  displayWidth: number,
  displayHeight: number,
  localRadius: number,
): BrushStroke | null {
  const points: number[] = [];
  for (let index = 0; index + 1 < localPoints.length; index += 2) {
    const x = localPoints[index] / displayWidth;
    const y = localPoints[index + 1] / displayHeight;
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    points.push(x, y);
  }
  if (points.length === 0) return null;
  return { points, radius: localRadius / displayWidth };
}

// 사진 지우기 모드를 지킬지 정합니다(SP-1). 들어갈 때 고른 사진(소유 사진)이
// 지금도 실제로 골라져 있고 문서에 남아 있을 때만 지킵니다.
export function shouldKeepPhotoEraseMode({
  eraseOwnerImageId,
  selectedImageId,
  userImages,
}: {
  eraseOwnerImageId: string | null;
  selectedImageId: string | null;
  userImages: ReadonlyArray<{ id: string }>;
}): boolean {
  if (!eraseOwnerImageId || selectedImageId !== eraseOwnerImageId) return false;
  return userImages.some((image) => image.id === eraseOwnerImageId);
}

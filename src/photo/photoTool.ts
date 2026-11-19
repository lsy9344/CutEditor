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

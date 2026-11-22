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
export const BRUSH_CURSOR_FILL_COLOR = "rgba(255,107,53,0.25)"; // 미리보기 획과 같은 색, 더 옅게
export const BRUSH_CURSOR_STROKE_COLOR = "#000";

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

// 휴대폰·데스크톱 배치가 바뀌면 캔버스가 다시 마운트되어 붓이 기본값으로 돌아가므로,
// 사진 지우기 모드도 함께 끝낼지 정합니다(D-6, ST1-1). 판단 방식은 shouldCloseMobileSheet와 같습니다.
export function shouldEndPhotoEraseOnLayoutChange({
  wasMobileEditor,
  isMobileEditor,
  isPhotoEraseMode,
}: {
  wasMobileEditor: boolean;
  isMobileEditor: boolean;
  isPhotoEraseMode: boolean;
}): boolean {
  return isPhotoEraseMode && wasMobileEditor !== isMobileEditor;
}

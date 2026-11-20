import type { SlotPosition, UserImage } from "../types/frame";

type SelectableImage = Pick<UserImage, "id" | "slotId" | "x" | "y" | "scaleX" | "scaleY" | "rotation">;

type SelectionState<TImage extends SelectableImage = SelectableImage> = {
  selection: string | null;
  selectedSlot: string | null;
  userImages: TImage[];
};

type NextImageSelectionArgs = SelectionState & {
  slotOrder: string[];
  direction: 1 | -1;
};

type DisplaySize = {
  width: number;
  height: number;
};

type KeyboardMoveArgs = {
  image: SelectableImage;
  slot: SlotPosition;
  displaySize: DisplaySize;
  delta: {
    x: number;
    y: number;
  };
};

type NudgedPositionArgs = {
  x: number;
  y: number;
  delta: {
    x: number;
    y: number;
  };
};

type ScaledTransformArgs = {
  image: SelectableImage;
  scaleFactor: number;
};

type RotatedTransformArgs = {
  image: SelectableImage;
  deltaDegrees: number;
};

export const KEYBOARD_MOVE_STEP = 5;
export const KEYBOARD_MOVE_FAST_STEP = 20;
export const KEYBOARD_SCALE_FACTOR = 1.1;
export const KEYBOARD_ROTATE_STEP = 5;

export const getSelectedImageFromState = <TImage extends SelectableImage>({
  selection,
  selectedSlot,
  userImages,
}: SelectionState<TImage>): TImage | null => {
  if (selection) {
    const selectedById = userImages.find((image) => image.id === selection);
    if (selectedById) return selectedById;
  }

  if (selectedSlot) {
    return userImages.find((image) => image.slotId === selectedSlot) ?? null;
  }

  return null;
};

export const getNextImageSelection = ({
  selection,
  selectedSlot,
  slotOrder,
  userImages,
  direction,
}: NextImageSelectionArgs): { imageId: string; slotId: string } | null => {
  const imagesBySlot = new Map(userImages.map((image) => [image.slotId, image]));
  const occupiedImages = slotOrder
    .map((slotId) => imagesBySlot.get(slotId))
    .filter((image): image is SelectableImage => Boolean(image));

  if (occupiedImages.length === 0) return null;

  const currentImage = getSelectedImageFromState({ selection, selectedSlot, userImages });
  if (!currentImage) {
    return {
      imageId: occupiedImages[0].id,
      slotId: occupiedImages[0].slotId,
    };
  }

  const currentIndex = occupiedImages.findIndex((image) => image.id === currentImage.id);
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (baseIndex + direction + occupiedImages.length) % occupiedImages.length;
  const nextImage = occupiedImages[nextIndex];

  return {
    imageId: nextImage.id,
    slotId: nextImage.slotId,
  };
};

export const getClampedKeyboardMove = ({
  image,
  slot,
  displaySize,
  delta,
}: KeyboardMoveArgs): { x: number; y: number } => {
  const scaleX = Number.isFinite(image.scaleX) ? image.scaleX : 1;
  const scaleY = Number.isFinite(image.scaleY) ? image.scaleY : 1;
  const currentX = Number.isFinite(image.x) ? image.x : 0;
  const currentY = Number.isFinite(image.y) ? image.y : 0;
  const scaledWidth = displaySize.width * scaleX;
  const scaledHeight = displaySize.height * scaleY;
  const centerOffsetX = (slot.width - displaySize.width) / 2;
  const centerOffsetY = (slot.height - displaySize.height) / 2;

  const minX = -scaledWidth - centerOffsetX;
  const maxX = slot.width - centerOffsetX;
  const minY = -scaledHeight - centerOffsetY;
  const maxY = slot.height - centerOffsetY;

  return {
    x: Math.max(minX, Math.min(maxX, currentX + delta.x)),
    y: Math.max(minY, Math.min(maxY, currentY + delta.y)),
  };
};

export const getNudgedPosition = ({
  x,
  y,
  delta,
}: NudgedPositionArgs): { x: number; y: number } => ({
  x: x + delta.x,
  y: y + delta.y,
});

export const getScaledTransform = ({
  image,
  scaleFactor,
}: ScaledTransformArgs): { scaleX: number; scaleY: number } => {
  const currentScale = Number.isFinite(image.scaleX) ? image.scaleX : 1;
  const nextScale = Math.max(0.1, currentScale * scaleFactor);

  return {
    scaleX: nextScale,
    scaleY: nextScale,
  };
};

export const getRotatedTransform = ({
  image,
  deltaDegrees,
}: RotatedTransformArgs): { rotation: number } => ({
  rotation: (Number.isFinite(image.rotation) ? image.rotation : 0) + deltaDegrees,
});

export const getContainedImageSize = (
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
): DisplaySize => {
  if (!imageWidth || !imageHeight || !slotWidth || !slotHeight) {
    return { width: slotWidth, height: slotHeight };
  }

  const imageAspectRatio = imageWidth / imageHeight;
  const slotAspectRatio = slotWidth / slotHeight;

  let width = slotWidth;
  let height = slotHeight;

  if (imageAspectRatio > slotAspectRatio) {
    height = slotWidth / imageAspectRatio;
  } else {
    width = slotHeight * imageAspectRatio;
  }

  return { width, height };
};

// 사진과 스티커가 함께 쓰는 위치·크기·회전 값(설계 7.1)
type TransformItem = Pick<SelectableImage, "x" | "y" | "scaleX" | "scaleY" | "rotation">;

type CenterRotatedTransformArgs = {
  image: TransformItem;
  displaySize: DisplaySize;
  deltaDegrees: number;
};

type CenterScaledTransformArgs = {
  item: TransformItem;
  size: DisplaySize;
  scaleFactor: number;
};

const finiteOr = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);

const rotateVector = (vector: { x: number; y: number }, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: vector.x * Math.cos(radians) - vector.y * Math.sin(radians),
    y: vector.x * Math.sin(radians) + vector.y * Math.cos(radians),
  };
};

// Konva는 사진·스티커를 왼쪽 위 기준으로 돌리므로, 가운데가 제자리에 있도록 x, y를 함께 옮깁니다.
export const getCenterRotatedTransform = ({
  image,
  displaySize,
  deltaDegrees,
}: CenterRotatedTransformArgs): { x: number; y: number; rotation: number } => {
  const x = finiteOr(image.x, 0);
  const y = finiteOr(image.y, 0);
  const scaleX = finiteOr(image.scaleX, 1);
  const scaleY = finiteOr(image.scaleY, 1);
  const rotation = finiteOr(image.rotation, 0);
  const halfSize = { x: (scaleX * displaySize.width) / 2, y: (scaleY * displaySize.height) / 2 };
  const before = rotateVector(halfSize, rotation);
  const nextRotation = rotation + deltaDegrees;
  const after = rotateVector(halfSize, nextRotation);

  return { x: x + before.x - after.x, y: y + before.y - after.y, rotation: nextRotation };
};

// 가운데를 지키며 크기를 바꿉니다. 0.1배보다 작아지지 않습니다.
export const getCenterScaledTransform = ({
  item,
  size,
  scaleFactor,
}: CenterScaledTransformArgs): { x: number; y: number; scaleX: number; scaleY: number } => {
  const x = finiteOr(item.x, 0);
  const y = finiteOr(item.y, 0);
  const scaleX = finiteOr(item.scaleX, 1);
  const scaleY = finiteOr(item.scaleY, 1);
  const rotation = finiteOr(item.rotation, 0);
  const nextScaleX = Math.max(0.1, scaleX * scaleFactor);
  const nextScaleY = Math.max(0.1, scaleY * scaleFactor);
  const before = rotateVector({ x: (scaleX * size.width) / 2, y: (scaleY * size.height) / 2 }, rotation);
  const after = rotateVector({ x: (nextScaleX * size.width) / 2, y: (nextScaleY * size.height) / 2 }, rotation);

  return { x: x + before.x - after.x, y: y + before.y - after.y, scaleX: nextScaleX, scaleY: nextScaleY };
};

export const isActivationKey = (key: string): boolean => key === "Enter" || key === " ";

// 마지막 사진에서 앞으로, 첫 사진(또는 선택 없음)에서 뒤로 가면 캔버스 밖으로 포커스를 넘깁니다.
export const isTabLeavingImages = ({
  selection,
  selectedSlot,
  slotOrder,
  userImages,
  direction,
}: NextImageSelectionArgs): boolean => {
  const imagesBySlot = new Map(userImages.map((image) => [image.slotId, image]));
  const occupiedImages = slotOrder
    .map((slotId) => imagesBySlot.get(slotId))
    .filter((image): image is SelectableImage => Boolean(image));

  if (occupiedImages.length === 0) return true;

  const currentImage = getSelectedImageFromState({ selection, selectedSlot, userImages });
  if (!currentImage) return direction === -1;

  const currentIndex = occupiedImages.findIndex((image) => image.id === currentImage.id);
  if (currentIndex < 0) return direction === -1;

  return direction === 1 ? currentIndex === occupiedImages.length - 1 : currentIndex === 0;
};

export const getScalePercent = (scaleX: number): number => (Number.isFinite(scaleX) ? Math.round(scaleX * 100) : 100);

export const getScaleFromPercent = (percent: number): number | null => {
  if (!Number.isFinite(percent) || percent <= 0) return null;
  return Math.max(0.1, percent / 100);
};

// 각도 숫자 입력의 값(valueAsNumber)을 적용할 정수 각도로 바꿉니다. 빈 칸이나 숫자가 아닌 입력은 null이라 무시합니다(설계 8.2, UP-6).
export const getAngleInputDegrees = (value: number): number | null => (Number.isFinite(value) ? Math.round(value) : null);

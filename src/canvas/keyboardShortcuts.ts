import type { SlotPosition, UserImage } from "../types/frame";

type SelectableImage = Pick<UserImage, "id" | "slotId" | "x" | "y" | "scaleX" | "scaleY" | "rotation">;

type SelectionState = {
  selection: string | null;
  selectedSlot: string | null;
  userImages: SelectableImage[];
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

export const getSelectedImageFromState = ({
  selection,
  selectedSlot,
  userImages,
}: SelectionState): SelectableImage | null => {
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

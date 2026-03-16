export type StickerEditState = {
  flipX: boolean;
  flipY: boolean;
  tintColor: string | null;
};

export const hasStickerEditChanges = (sticker: StickerEditState): boolean =>
  sticker.flipX || sticker.flipY || sticker.tintColor !== null;

export const getStickerEditResetUpdates = (): StickerEditState => ({
  flipX: false,
  flipY: false,
  tintColor: null,
});

export const STICKER_SLOT_COUNT = 10;
export const STICKER_EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"] as const;

export type StickerSlot = {
  key: string;
  candidates: string[];
};

export function buildStickerSlots(): StickerSlot[] {
  return Array.from({ length: STICKER_SLOT_COUNT }, (_, index) => {
    const key = `${index + 1}s`;

    return {
      key,
      candidates: STICKER_EXTENSIONS.map((extension) => `/stickers/${key}.${extension}`),
    };
  });
}

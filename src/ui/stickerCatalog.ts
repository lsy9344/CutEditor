export const STICKER_SLOT_COUNT = 10;
export const STICKER_EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"] as const;

export type StickerSlot = {
  key: string;
  candidates: string[];
};

export type StickerCategory = {
  id: string;
  label: string;
  description: string;
  assetPrefix: string;
  previewCandidates: string[];
  stickers: StickerSlot[];
};

function buildStickerPath(key: string): string[] {
  return STICKER_EXTENSIONS.map((extension) => `/stickers/${key}.${extension}`);
}

export function buildStickerSlots(prefix: string): StickerSlot[] {
  return Array.from({ length: STICKER_SLOT_COUNT }, (_, index) => {
    const key = `${prefix}_${index + 1}ss`;

    return {
      key,
      candidates: buildStickerPath(key),
    };
  });
}

// Temporary mock categories for the new UI
export const STICKER_CATEGORIES: StickerCategory[] = [
  {
    id: "basic",
    label: "기본 스티커",
    description: "다양한 기본 도형과 기호",
    assetPrefix: "1s",
    previewCandidates: buildStickerPath("1s"),
    stickers: buildStickerSlots("1s"),
  },
  {
    id: "deco",
    label: "꾸미기 스티커",
    description: "귀여운 장식용 스티커",
    assetPrefix: "2s",
    previewCandidates: buildStickerPath("2s"),
    stickers: buildStickerSlots("2s"),
  }
];

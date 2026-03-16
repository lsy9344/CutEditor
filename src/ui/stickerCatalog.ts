export const STICKER_SLOT_COUNT = 20;
export const STICKER_EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"] as const;

const STICKER_CANDIDATE_PRIORITY_OVERRIDES: Record<string, readonly string[]> = {
  // iOS canvas/Konva can fail to render this masked SVG after insertion, so prefer PNG.
  "1s_18ss": ["png", "svg", "webp", "jpg", "jpeg"],
};

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
  const extensions = STICKER_CANDIDATE_PRIORITY_OVERRIDES[key] ?? STICKER_EXTENSIONS;

  return extensions.map((extension) => `/stickers/${key}.${extension}`);
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
    label: "레터링 스티커",
    description: "해피 벌스데이, 기념일, 특별한 순간 메세지",
    assetPrefix: "2s",
    previewCandidates: buildStickerPath("2s"),
    stickers: buildStickerSlots("2s"),
  },
  {
    id: "point",
    label: "흑백 일러스트",
    description: "사람이 그린 것 같은 흑백 일러스트",
    assetPrefix: "3s",
    previewCandidates: buildStickerPath("3s"),
    stickers: buildStickerSlots("3s"),
  }
];

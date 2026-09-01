import { buildStickerCandidatesForKey } from "../utils/stickerAssetCandidates";

export const STICKER_EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"] as const;

const SVG_STICKER_SLOT_KEY_PATTERN = /^(1s|2s|3s|4s)_\d+ss$/;

export type StickerSlot = {
  key: string;
  candidates: string[];
};

export type StickerCategory = {
  id: string;
  label: string;
  description: string;
  assetPrefix: string;
  slotCount: number;
  previewCandidates: string[];
  stickers: StickerSlot[];
};

function buildStickerPath(key: string, extensions: readonly string[] = STICKER_EXTENSIONS): string[] {
  return extensions.map((extension) => `/stickers/${key}.${extension}`);
}

export function buildStickerCandidates(key: string): string[] {
  if (SVG_STICKER_SLOT_KEY_PATTERN.test(key)) {
    return buildStickerCandidatesForKey(key);
  }

  return buildStickerPath(key);
}

export function buildStickerSlots(prefix: string, slotCount: number): StickerSlot[] {
  return Array.from({ length: slotCount }, (_, index) => {
    const key = `${prefix}_${index + 1}ss`;

    return {
      key,
      candidates: buildStickerCandidates(key),
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
    slotCount: 43,
    previewCandidates: buildStickerPath("1s"),
    stickers: buildStickerSlots("1s", 43),
  },
  {
    id: "deco",
    label: "레터링 스티커",
    description: "해피 벌스데이, 기념일, 특별한 순간 메세지",
    assetPrefix: "2s",
    slotCount: 31,
    previewCandidates: buildStickerPath("2s"),
    stickers: buildStickerSlots("2s", 31),
  },
  {
    id: "point",
    label: "흑백 일러스트",
    description: "사람이 그린 것 같은 흑백 일러스트",
    assetPrefix: "3s",
    slotCount: 30,
    previewCandidates: buildStickerPath("3s"),
    stickers: buildStickerSlots("3s", 30),
  },
  {
    id: "bubble",
    label: "말풍선",
    description: "생각과 대화를 담는 말풍선",
    assetPrefix: "4s",
    slotCount: 11,
    previewCandidates: buildStickerPath("4s"),
    stickers: buildStickerSlots("4s", 11),
  }
];

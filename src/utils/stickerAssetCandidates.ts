export const STICKER_FALLBACK_EXTENSIONS = ["webp", "jpg", "jpeg"] as const;

export type StickerAssetAudit = {
  pngHasTransparency: boolean;
  svgContainsEmbeddedRaster: boolean;
  svgUsesMask: boolean;
};

export type StickerAssetPreference = "png-first" | "svg-first";

// 2026-03-21 전수 점검 결과:
// - PNG 투명도 유지 여부
// - SVG 내부 임베디드 래스터 포함 여부
// - SVG 마스크 사용 여부
// 를 기준으로 iPhone 비표시 문제와 흰 배경 회귀를 동시에 피한다.
// 2026-09-01 신규 자산(1s_21ss~43ss, 2s_23ss~31ss, 4s_1ss~11ss)은 투명 PNG 단독 자산으로 검증을 통과했다.
const AUDITED_STICKER_KEYS = [
  "1s_1ss",
  "1s_2ss",
  "1s_3ss",
  "1s_4ss",
  "1s_5ss",
  "1s_6ss",
  "1s_7ss",
  "1s_8ss",
  "1s_9ss",
  "1s_10ss",
  "1s_11ss",
  "1s_12ss",
  "1s_13ss",
  "1s_14ss",
  "1s_15ss",
  "1s_16ss",
  "1s_17ss",
  "1s_18ss",
  "1s_19ss",
  "1s_20ss",
  "1s_21ss",
  "1s_22ss",
  "1s_23ss",
  "1s_24ss",
  "1s_25ss",
  "1s_26ss",
  "1s_27ss",
  "1s_28ss",
  "1s_29ss",
  "1s_30ss",
  "1s_31ss",
  "1s_32ss",
  "1s_33ss",
  "1s_34ss",
  "1s_35ss",
  "1s_36ss",
  "1s_37ss",
  "1s_38ss",
  "1s_39ss",
  "1s_40ss",
  "1s_41ss",
  "1s_42ss",
  "1s_43ss",
  "2s_1ss",
  "2s_2ss",
  "2s_3ss",
  "2s_4ss",
  "2s_5ss",
  "2s_6ss",
  "2s_7ss",
  "2s_8ss",
  "2s_9ss",
  "2s_10ss",
  "2s_11ss",
  "2s_12ss",
  "2s_13ss",
  "2s_14ss",
  "2s_15ss",
  "2s_16ss",
  "2s_17ss",
  "2s_18ss",
  "2s_19ss",
  "2s_20ss",
  "2s_21ss",
  "2s_22ss",
  "2s_23ss",
  "2s_24ss",
  "2s_25ss",
  "2s_26ss",
  "2s_27ss",
  "2s_28ss",
  "2s_29ss",
  "2s_30ss",
  "2s_31ss",
  "3s_1ss",
  "3s_2ss",
  "3s_3ss",
  "3s_4ss",
  "3s_5ss",
  "3s_6ss",
  "3s_7ss",
  "3s_8ss",
  "3s_9ss",
  "3s_10ss",
  "3s_11ss",
  "3s_12ss",
  "3s_13ss",
  "3s_14ss",
  "3s_15ss",
  "3s_16ss",
  "3s_17ss",
  "3s_18ss",
  "3s_19ss",
  "3s_20ss",
  "3s_21ss",
  "3s_24ss",
  "3s_25ss",
  "3s_27ss",
  "3s_28ss",
  "3s_29ss",
  "3s_30ss",
  "4s_1ss",
  "4s_2ss",
  "4s_3ss",
  "4s_4ss",
  "4s_5ss",
  "4s_6ss",
  "4s_7ss",
  "4s_8ss",
  "4s_9ss",
  "4s_10ss",
  "4s_11ss",
] as const;

const PNG_TRANSPARENT_KEYS = [
  "1s_1ss",
  "1s_2ss",
  "1s_3ss",
  "1s_4ss",
  "1s_5ss",
  "1s_6ss",
  "1s_7ss",
  "1s_8ss",
  "1s_9ss",
  "1s_10ss",
  "1s_11ss",
  "1s_12ss",
  "1s_13ss",
  "1s_14ss",
  "1s_15ss",
  "1s_16ss",
  "1s_17ss",
  "1s_18ss",
  "1s_19ss",
  "1s_20ss",
  "1s_21ss",
  "1s_22ss",
  "1s_23ss",
  "1s_24ss",
  "1s_25ss",
  "1s_26ss",
  "1s_27ss",
  "1s_28ss",
  "1s_29ss",
  "1s_30ss",
  "1s_31ss",
  "1s_32ss",
  "1s_33ss",
  "1s_34ss",
  "1s_35ss",
  "1s_36ss",
  "1s_37ss",
  "1s_38ss",
  "1s_39ss",
  "1s_40ss",
  "1s_41ss",
  "1s_42ss",
  "1s_43ss",
  "2s_1ss",
  "2s_2ss",
  "2s_3ss",
  "2s_4ss",
  "3s_1ss",
  "3s_2ss",
  "3s_3ss",
  "3s_4ss",
  "3s_5ss",
  "3s_6ss",
  "3s_7ss",
  "3s_8ss",
  "3s_9ss",
  "3s_10ss",
  "3s_11ss",
  "3s_12ss",
  "3s_13ss",
  "3s_14ss",
  "3s_15ss",
  "3s_16ss",
  "3s_17ss",
  "3s_18ss",
  "3s_19ss",
  "3s_20ss",
  "3s_21ss",
  "3s_24ss",
  "3s_25ss",
  "3s_27ss",
  "3s_28ss",
  "3s_29ss",
  "3s_30ss",
  "2s_23ss",
  "2s_24ss",
  "2s_25ss",
  "2s_26ss",
  "2s_27ss",
  "2s_28ss",
  "2s_29ss",
  "2s_30ss",
  "2s_31ss",
  "4s_1ss",
  "4s_2ss",
  "4s_3ss",
  "4s_4ss",
  "4s_5ss",
  "4s_6ss",
  "4s_7ss",
  "4s_8ss",
  "4s_9ss",
  "4s_10ss",
  "4s_11ss",
] as const;

const SVG_EMBEDDED_RASTER_KEYS = [
  "1s_1ss",
  "1s_2ss",
  "1s_3ss",
  "1s_4ss",
  "1s_5ss",
  "1s_6ss",
  "1s_7ss",
  "1s_8ss",
  "1s_9ss",
  "1s_10ss",
  "1s_11ss",
  "1s_14ss",
  "1s_15ss",
  "1s_16ss",
  "1s_17ss",
  "1s_18ss",
  "1s_19ss",
  "1s_20ss",
  "2s_1ss",
  "2s_2ss",
  "2s_3ss",
  "2s_5ss",
  "2s_16ss",
  "2s_19ss",
  "2s_21ss",
  "3s_1ss",
  "3s_2ss",
  "3s_3ss",
  "3s_4ss",
  "3s_5ss",
  "3s_6ss",
  "3s_7ss",
  "3s_8ss",
  "3s_9ss",
  "3s_10ss",
  "3s_11ss",
  "3s_12ss",
  "3s_13ss",
  "3s_14ss",
  "3s_15ss",
  "3s_16ss",
  "3s_17ss",
  "3s_18ss",
  "3s_19ss",
  "3s_20ss",
  "3s_21ss",
  "3s_24ss",
  "3s_25ss",
  "3s_27ss",
  "3s_28ss",
  "3s_29ss",
  "3s_30ss",
] as const;

const SVG_MASK_KEYS = [
  "1s_1ss",
  "1s_2ss",
  "1s_3ss",
  "1s_4ss",
  "1s_5ss",
  "1s_6ss",
  "1s_7ss",
  "1s_8ss",
  "1s_9ss",
  "1s_10ss",
  "1s_11ss",
  "1s_14ss",
  "1s_15ss",
  "1s_16ss",
  "1s_17ss",
  "1s_18ss",
  "1s_19ss",
  "1s_20ss",
  "2s_1ss",
  "2s_2ss",
  "2s_3ss",
  "2s_5ss",
  "2s_16ss",
  "2s_17ss",
  "2s_19ss",
  "2s_21ss",
  "3s_1ss",
  "3s_2ss",
  "3s_3ss",
  "3s_4ss",
  "3s_5ss",
  "3s_6ss",
  "3s_7ss",
  "3s_8ss",
  "3s_9ss",
  "3s_10ss",
  "3s_11ss",
  "3s_12ss",
  "3s_13ss",
  "3s_14ss",
  "3s_15ss",
  "3s_16ss",
  "3s_17ss",
  "3s_18ss",
  "3s_19ss",
  "3s_20ss",
  "3s_21ss",
  "3s_24ss",
  "3s_25ss",
  "3s_27ss",
  "3s_28ss",
  "3s_29ss",
  "3s_30ss",
] as const;

const PNG_TRANSPARENT_KEY_SET = new Set<string>(PNG_TRANSPARENT_KEYS);
const SVG_EMBEDDED_RASTER_KEY_SET = new Set<string>(SVG_EMBEDDED_RASTER_KEYS);
const SVG_MASK_KEY_SET = new Set<string>(SVG_MASK_KEYS);

export const STICKER_ASSET_AUDIT = Object.fromEntries(
  AUDITED_STICKER_KEYS.map((key) => [
    key,
    {
      pngHasTransparency: PNG_TRANSPARENT_KEY_SET.has(key),
      svgContainsEmbeddedRaster: SVG_EMBEDDED_RASTER_KEY_SET.has(key),
      svgUsesMask: SVG_MASK_KEY_SET.has(key),
    },
  ]),
) as Record<string, StickerAssetAudit>;

const STICKER_KEY_PATTERN = /^([1234]s_\d+ss)$/i;

function getStickerAssetPreferenceFromAudit(audit: StickerAssetAudit): StickerAssetPreference {
  if (!audit.pngHasTransparency) {
    return "svg-first";
  }

  if (audit.svgContainsEmbeddedRaster || audit.svgUsesMask) {
    return "png-first";
  }

  return "svg-first";
}

export function getStickerAssetPreference(key: string): StickerAssetPreference {
  const audit = STICKER_ASSET_AUDIT[key];
  if (!audit) {
    return "svg-first";
  }

  return getStickerAssetPreferenceFromAudit(audit);
}

export const STICKER_RASTER_FIRST_KEYS = AUDITED_STICKER_KEYS.filter(
  (key) => getStickerAssetPreference(key) === "png-first",
);

export function prefersRasterStickerAsset(key: string): boolean {
  return getStickerAssetPreference(key) === "png-first";
}

export function buildStickerCandidatesForKey(key: string): string[] {
  if (!STICKER_KEY_PATTERN.test(key)) {
    return [
      `/stickers/${key}.svg`,
      `/stickers/${key}.png`,
      ...STICKER_FALLBACK_EXTENSIONS.map((extension) => `/stickers/${key}.${extension}`),
    ];
  }

  const primaryExtensions = prefersRasterStickerAsset(key)
    ? ["png", "svg"]
    : ["svg", "png"];

  return [
    ...primaryExtensions.map((extension) => `/stickers/${key}.${extension}`),
    ...STICKER_FALLBACK_EXTENSIONS.map((extension) => `/stickers/${key}.${extension}`),
  ];
}

export function getStickerAssetCandidates(src: string): string[] {
  const normalizedSrc = src.trim();

  if (!normalizedSrc) {
    return [];
  }

  const match = normalizedSrc.match(/\/stickers\/([1234]s_\d+ss)\.[a-z0-9]+$/i);
  if (!match) {
    return [normalizedSrc];
  }

  return buildStickerCandidatesForKey(match[1]);
}

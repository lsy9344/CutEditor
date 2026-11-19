export type PhotoAdjust = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export type BrushStroke = {
  points: number[];
  radius: number;
};

export type PhotoPresetId = "original" | "bright" | "warm" | "calm" | "mono";

export type PhotoEdits = {
  adjust: PhotoAdjust;
  presetId: PhotoPresetId | null;
  erase: BrushStroke[];
};

export type PhotoAdjustField = {
  key: keyof PhotoAdjust;
  label: string;
  min: number;
  max: number;
  step: number;
};

const ADJUST_MIN = -100;
const ADJUST_MAX = 100;
const ADJUST_STEP = 10;

export const PHOTO_ADJUST_FIELDS: PhotoAdjustField[] = [
  { key: "brightness", label: "밝기", min: ADJUST_MIN, max: ADJUST_MAX, step: ADJUST_STEP },
  { key: "contrast", label: "선명하게", min: ADJUST_MIN, max: ADJUST_MAX, step: ADJUST_STEP },
  { key: "saturation", label: "색감", min: ADJUST_MIN, max: ADJUST_MAX, step: ADJUST_STEP },
  { key: "warmth", label: "따뜻하게", min: ADJUST_MIN, max: ADJUST_MAX, step: ADJUST_STEP },
];

export const PHOTO_PRESETS: { id: PhotoPresetId; label: string; adjust: PhotoAdjust }[] = [
  {
    id: "original",
    label: "원본",
    adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
  },
  {
    id: "bright",
    label: "화사하게",
    adjust: { brightness: 10, contrast: 10, saturation: 15, warmth: 0 },
  },
  {
    id: "warm",
    label: "따뜻하게",
    adjust: { brightness: 5, contrast: 0, saturation: 10, warmth: 30 },
  },
  {
    id: "calm",
    label: "차분하게",
    adjust: { brightness: 0, contrast: -10, saturation: -20, warmth: -15 },
  },
  {
    id: "mono",
    label: "흑백",
    adjust: { brightness: 0, contrast: 15, saturation: -100, warmth: 0 },
  },
];

export function createDefaultPhotoEdits(): PhotoEdits {
  return {
    adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    presetId: "original",
    erase: [],
  };
}

export function isIdentityAdjust(adjust: PhotoAdjust): boolean {
  return (
    adjust.brightness === 0 &&
    adjust.contrast === 0 &&
    adjust.saturation === 0 &&
    adjust.warmth === 0
  );
}

export function isDefaultPhotoEdits(edits: PhotoEdits): boolean {
  return isIdentityAdjust(edits.adjust) && edits.erase.length === 0;
}

export function applyPresetToEdits(edits: PhotoEdits, presetId: PhotoPresetId): PhotoEdits {
  const preset = PHOTO_PRESETS.find((candidate) => candidate.id === presetId);

  if (!preset) {
    return edits;
  }

  return {
    ...edits,
    adjust: { ...preset.adjust },
    presetId,
  };
}

export function stepAdjustField(
  edits: PhotoEdits,
  key: keyof PhotoAdjust,
  direction: 1 | -1,
): PhotoEdits {
  const field = PHOTO_ADJUST_FIELDS.find((candidate) => candidate.key === key);

  if (!field) {
    return edits;
  }

  const next = Math.min(
    field.max,
    Math.max(field.min, edits.adjust[key] + direction * field.step),
  );

  return {
    ...edits,
    adjust: { ...edits.adjust, [key]: next },
    presetId: null,
  };
}

export function copyAdjustToAll<T extends { id: string; edits: PhotoEdits }>(
  images: T[],
  sourceImageId: string,
): T[] {
  const source = images.find((image) => image.id === sourceImageId);

  if (!source) {
    return images;
  }

  return images.map((image) => ({
    ...image,
    edits: {
      ...image.edits,
      adjust: { ...source.edits.adjust },
      presetId: source.edits.presetId,
    },
  }));
}

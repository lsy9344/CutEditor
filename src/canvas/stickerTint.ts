export type StickerTintMode = "multiply" | "recolor";

const LETTERING_STICKER_SRC_PATTERN = /\/stickers\/2s_\d+ss\./i;

export function getStickerTintMode(src: string): StickerTintMode {
  return LETTERING_STICKER_SRC_PATTERN.test(src) ? "recolor" : "multiply";
}

function parseTintColor(tintColor: string): { r: number; g: number; b: number } | null {
  const hex = tintColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

export function createStickerTintFilter(
  tintColor: string,
  mode: StickerTintMode,
): (imageData: ImageData) => void {
  const tint = parseTintColor(tintColor);
  if (!tint) {
    return () => {};
  }

  if (mode === "recolor") {
    return (imageData: ImageData) => {
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = tint.r;
        data[i + 1] = tint.g;
        data[i + 2] = tint.b;
      }
    };
  }

  const tR = tint.r / 255;
  const tG = tint.g / 255;
  const tB = tint.b / 255;
  return (imageData: ImageData) => {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(data[i] * tR);
      data[i + 1] = Math.round(data[i + 1] * tG);
      data[i + 2] = Math.round(data[i + 2] * tB);
    }
  };
}

import { mmToPx } from "./units.ts";

export type StickerDimensions = {
  width: number;
  height: number;
};

type StickerImageLoader = (src: string) => Promise<StickerDimensions>;

type LoadStickerDimensionsOptions = {
  fallbackWidth: number;
  fallbackHeight: number;
  imageLoader?: StickerImageLoader;
};

type CenteredStickerPositionOptions = {
  canvasWidth: number;
  canvasHeight: number;
  stickerWidth: number;
  stickerHeight: number;
};

export const DEFAULT_STICKER_WIDTH = 100;
export const DEFAULT_STICKER_HEIGHT = 100;
export const DEFAULT_STICKER_INSERT_LONGEST_EDGE_MM = 18;
export const CSS_DPI = 96;
const STICKER_RASTER_EXTENSIONS = ["png", "webp", "jpg", "jpeg"] as const;

const isValidDimension = (value: number) => Number.isFinite(value) && value > 0;

const loadImageDimensionsInBrowser: StickerImageLoader = async (src) => {
  if (typeof window === "undefined" || typeof window.Image === "undefined") {
    throw new Error("Browser image loader is unavailable.");
  }

  return new Promise<StickerDimensions>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      if (!isValidDimension(width) || !isValidDimension(height)) {
        reject(new Error("Invalid sticker dimensions."));
        return;
      }

      resolve({ width, height });
    };
    image.onerror = () => reject(new Error(`Failed to load sticker image: ${src}`));
    image.src = src;
  });
};

export function getStickerAssetCandidates(src: string): string[] {
  const normalizedSrc = src.trim();

  if (!normalizedSrc) {
    return [];
  }

  const lowerSrc = normalizedSrc.toLowerCase();
  if (!lowerSrc.endsWith(".svg")) {
    return [normalizedSrc];
  }

  const rasterCandidates = STICKER_RASTER_EXTENSIONS.map((extension) => (
    normalizedSrc.replace(/\.svg$/i, `.${extension}`)
  ));

  return [normalizedSrc, ...rasterCandidates];
}

export async function loadStickerDimensions(
  src: string,
  options: LoadStickerDimensionsOptions,
): Promise<StickerDimensions> {
  const fallback = {
    width: options.fallbackWidth,
    height: options.fallbackHeight,
  };

  try {
    const imageLoader = options.imageLoader ?? loadImageDimensionsInBrowser;
    const candidates = getStickerAssetCandidates(src);
    let dimensions: StickerDimensions | null = null;

    for (const candidate of candidates) {
      try {
        dimensions = await imageLoader(candidate);
        break;
      } catch {
        // 다음 대체 자산을 시도한다.
      }
    }

    if (!dimensions) {
      return fallback;
    }

    if (!isValidDimension(dimensions.width) || !isValidDimension(dimensions.height)) {
      return fallback;
    }

    return dimensions;
  } catch {
    return fallback;
  }
}

export function getCenteredStickerPosition({
  canvasWidth,
  canvasHeight,
  stickerWidth,
  stickerHeight,
}: CenteredStickerPositionOptions) {
  return {
    x: (canvasWidth - stickerWidth) / 2,
    y: (canvasHeight - stickerHeight) / 2,
  };
}

export function getInitialStickerScale({
  width,
  height,
  targetLongestEdgeMm = DEFAULT_STICKER_INSERT_LONGEST_EDGE_MM,
  cssDpi = CSS_DPI,
}: {
  width: number;
  height: number;
  targetLongestEdgeMm?: number;
  cssDpi?: number;
}) {
  if (!isValidDimension(width) || !isValidDimension(height)) {
    return 1;
  }

  const longestEdge = Math.max(width, height);
  const targetLongestEdgePx = mmToPx(targetLongestEdgeMm, cssDpi);

  if (!isValidDimension(targetLongestEdgePx)) {
    return 1;
  }

  return Math.min(1, targetLongestEdgePx / longestEdge);
}

export function getScaledStickerDimensions({
  width,
  height,
  scale,
}: {
  width: number;
  height: number;
  scale: number;
}): StickerDimensions {
  if (!isValidDimension(width) || !isValidDimension(height) || !isValidDimension(scale)) {
    return { width, height };
  }

  return {
    width: width * scale,
    height: height * scale,
  };
}

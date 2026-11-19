import type { PhotoEdits } from "./photoEdits.ts";
import { isDefaultPhotoEdits } from "./photoEdits.ts";
import { renderAdjustedPhoto, renderPhotoBase } from "./photoRender.ts";

type EditedPhotoCacheEntry = {
  baseKey: string;
  base: HTMLCanvasElement | null;
  key: string;
  canvas: HTMLCanvasElement;
};

const editedPhotoCache = new Map<string, EditedPhotoCacheEntry>();

export function getEditedPhotoCanvas(
  imageId: string,
  source: HTMLImageElement,
  edits: PhotoEdits,
  maxSide: number,
  keepBase: boolean,
): HTMLCanvasElement | null {
  if (isDefaultPhotoEdits(edits)) {
    editedPhotoCache.delete(imageId);
    return null;
  }

  const baseKey = JSON.stringify({ erase: edits.erase, maxSide });
  const key = baseKey + JSON.stringify(edits.adjust);
  const cached = editedPhotoCache.get(imageId);

  if (cached && cached.key === key) {
    return cached.canvas;
  }

  try {
    const base =
      cached && cached.baseKey === baseKey && cached.base
        ? cached.base
        : renderPhotoBase(source, edits.erase, maxSide);
    const canvas = renderAdjustedPhoto(base, edits.adjust);

    editedPhotoCache.set(imageId, {
      baseKey,
      base: keepBase ? base : null,
      key,
      canvas,
    });

    return canvas;
  } catch {
    editedPhotoCache.delete(imageId);
    return null;
  }
}

export function pruneEditedPhotoCanvases(
  activeImageIds: Set<string>,
  selectedImageId: string | null,
): void {
  for (const [imageId, entry] of editedPhotoCache) {
    if (!activeImageIds.has(imageId)) {
      editedPhotoCache.delete(imageId);
      continue;
    }

    if (imageId !== selectedImageId) {
      entry.base = null;
    }
  }
}

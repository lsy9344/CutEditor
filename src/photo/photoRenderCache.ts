import type { PhotoEdits } from "./photoEdits.ts";
import { isDefaultPhotoEdits, isIdentityAdjust } from "./photoEdits.ts";
import {
  getWorkingSize,
  isPhotoWorkingSizeClamped,
  isStrokeSeparatedFromStrokes,
  renderAdjustedPhoto,
  renderBrushStrokeOnBase,
  renderPhotoBase,
} from "./photoRender.ts";

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

  if (isPhotoWorkingSizeClamped(source.naturalWidth, source.naturalHeight, maxSide)) {
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
    const previousErase = edits.erase.slice(0, -1);
    const appendedStroke = edits.erase.length > 0 ? edits.erase[edits.erase.length - 1] : null;
    const previousBaseKey = JSON.stringify({ erase: previousErase, maxSide });

    let base: HTMLCanvasElement;
    if (cached && cached.base && appendedStroke && cached.baseKey === previousBaseKey) {
      const workingSize = getWorkingSize(source.naturalWidth, source.naturalHeight, maxSide);
      const canReuseBase = isStrokeSeparatedFromStrokes(
        appendedStroke,
        previousErase,
        workingSize.width,
        workingSize.height,
      );
      base = canReuseBase
        ? renderBrushStrokeOnBase(cached.base, appendedStroke)
        : renderPhotoBase(source, edits.erase, maxSide);
    } else {
      base = cached && cached.baseKey === baseKey && cached.base
        ? cached.base
        : renderPhotoBase(source, edits.erase, maxSide);
    }

    // 보정이 기본값이면 지우기 결과를 그대로 쓴다. 전체 캔버스를 한 번 더 읽고 쓰지 않는다.
    const canvas = isIdentityAdjust(edits.adjust)
      ? base
      : renderAdjustedPhoto(base, edits.adjust);

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
  editedImageIds?: Set<string>,
): void {
  for (const [imageId, entry] of editedPhotoCache) {
    const isActiveEditedPhoto = !editedImageIds || editedImageIds.has(imageId);

    if (!activeImageIds.has(imageId) || !isActiveEditedPhoto) {
      editedPhotoCache.delete(imageId);
      continue;
    }

    if (imageId !== selectedImageId) {
      entry.base = null;
    }
  }
}

// E2E에서 보정 캐시가 실제로 비워졌는지 읽기만 하는 통계다.
export function getEditedPhotoCacheStats(): Array<{
  imageId: string;
  width: number;
  height: number;
  hasBase: boolean;
}> {
  return Array.from(editedPhotoCache, ([imageId, entry]) => ({
    imageId,
    width: entry.canvas.width,
    height: entry.canvas.height,
    hasBase: entry.base !== null,
  }));
}

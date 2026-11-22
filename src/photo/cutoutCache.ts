import type { CutoutTarget } from "./cutoutTypes.ts";
import { getCutoutTargetKey } from "./cutoutTypes.ts";
import { segmentAtPoint, segmentEveryone } from "./segmentation.ts";

export const CUTOUT_CACHE_MAX_STICKERS = 3;
export const CUTOUT_CACHE_MAX_MASKS_PER_STICKER = 2;

type CutoutCacheEntry = {
  workingCanvas: HTMLCanvasElement;
  confidences: Map<string, Float32Array>;
};

const cutoutCache = new Map<string, CutoutCacheEntry>();

export function setCutoutWorkingCanvas(stickerId: string, canvas: HTMLCanvasElement): void {
  cutoutCache.delete(stickerId);
  cutoutCache.set(stickerId, { workingCanvas: canvas, confidences: new Map() });
  while (cutoutCache.size > CUTOUT_CACHE_MAX_STICKERS) {
    const oldestId = cutoutCache.keys().next().value;
    if (oldestId === undefined) break;
    cutoutCache.delete(oldestId);
  }
}

export function hasCutoutWorkingCanvas(stickerId: string): boolean {
  return cutoutCache.has(stickerId);
}

export function getCutoutWorkingCanvas(stickerId: string): HTMLCanvasElement | null {
  const entry = cutoutCache.get(stickerId);
  if (!entry) return null;
  cutoutCache.delete(stickerId); // 최근에 쓴 항목으로 순서를 바꿈
  cutoutCache.set(stickerId, entry);
  return entry.workingCanvas;
}

// 순서를 바꾸지 않고 작업 캔버스를 읽습니다(되살리기 원본 깔기처럼 렌더 때 보기만 할 때).
export function peekCutoutWorkingCanvas(stickerId: string): HTMLCanvasElement | null {
  return cutoutCache.get(stickerId)?.workingCanvas ?? null;
}

export function rememberCutoutConfidence(
  stickerId: string,
  target: CutoutTarget,
  confidence: Float32Array,
): void {
  const entry = cutoutCache.get(stickerId);
  if (!entry) return; // 작업 캔버스 없이 마스크만 남기지 않음

  const targetKey = getCutoutTargetKey(target);
  entry.confidences.delete(targetKey);
  entry.confidences.set(targetKey, confidence);
  while (entry.confidences.size > CUTOUT_CACHE_MAX_MASKS_PER_STICKER) {
    const oldestKey = entry.confidences.keys().next().value;
    if (oldestKey === undefined) break;
    entry.confidences.delete(oldestKey);
  }

  cutoutCache.delete(stickerId); // 최근에 쓴 항목으로 순서를 바꿈
  cutoutCache.set(stickerId, entry);
}

export function peekCutoutConfidence(
  stickerId: string,
  target: CutoutTarget,
): Float32Array | null {
  const entry = cutoutCache.get(stickerId);
  if (!entry) return null;
  return entry.confidences.get(getCutoutTargetKey(target)) ?? null;
}

// 캐시에 없는 마스크를 계산해 돌려줍니다. 캐시에는 넣지 않습니다.
// 부른 쪽이 유효한 작업으로 확인한 뒤에만 캐시에 저장합니다.
export async function getCutoutConfidence(
  stickerId: string,
  target: CutoutTarget,
  isCancelled: () => boolean,
): Promise<Float32Array | null> {
  const entry = cutoutCache.get(stickerId);
  if (!entry) return null;
  const cached = entry.confidences.get(getCutoutTargetKey(target));
  if (cached) return cached;
  if (target.kind === "point") {
    return segmentAtPoint(entry.workingCanvas, { x: target.x, y: target.y }, isCancelled);
  }
  return segmentEveryone(entry.workingCanvas, isCancelled);
}

export function pruneCutoutCache(activeStickerIds: Set<string>): void {
  for (const stickerId of Array.from(cutoutCache.keys())) {
    if (!activeStickerIds.has(stickerId)) cutoutCache.delete(stickerId);
  }
}

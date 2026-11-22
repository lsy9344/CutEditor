import type { BrushStroke } from "./photoEdits.ts";

export type CutoutTarget = { kind: "everyone" } | { kind: "point"; x: number; y: number };
export type CutoutSubject = "person" | "thing";
export type CutoutRect = { x: number; y: number; width: number; height: number };
export type CutoutSize = { width: number; height: number };
export type CutoutSource = {
  sourceImageId: string;
  subject?: CutoutSubject; // 없으면 사람(1단계 스티커)
  target: CutoutTarget;
  outline: boolean;
  eraseStrokes: BrushStroke[];
  crop: CutoutRect;
  workingSize: CutoutSize;
};
export type CutoutChanges = Partial<Pick<CutoutSource, "target" | "outline" | "eraseStrokes">>;

export function getCutoutTargetKey(target: CutoutTarget): string {
  if (target.kind === "everyone") return "everyone";
  return `point:${target.x.toFixed(4)}:${target.y.toFixed(4)}`;
}

export type CutoutImageEntry = {
  id: string;
  src: string;
  loadedSrc: string | null;
  failedSrc: string | null;
};
export type CutoutImagesState =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "failed"; stickerIds: string[] };

export function getCutoutImagesState(entries: CutoutImageEntry[]): CutoutImagesState {
  const failedIds: string[] = [];

  for (const entry of entries) {
    if (entry.loadedSrc === entry.src) continue;
    if (entry.failedSrc !== entry.src) return { kind: "loading" };
    failedIds.push(entry.id);
  }

  if (failedIds.length > 0) return { kind: "failed", stickerIds: failedIds };
  return { kind: "ready" };
}

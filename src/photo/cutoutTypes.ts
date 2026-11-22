import type { BrushStroke } from "./photoEdits.ts";

export type CutoutTarget = { kind: "everyone" } | { kind: "point"; x: number; y: number };
export type CutoutSubject = "person" | "thing";
export type CutoutRect = { x: number; y: number; width: number; height: number };
export type CutoutSize = { width: number; height: number };
// clip은 되살림만, 작업 크기 0~1, 획을 시작할 때의 crop + 반지름입니다. action이 없으면 지움(옛 획).
export type CutoutStroke = BrushStroke & { action?: "erase" | "restore"; clip?: CutoutRect };
export type CutoutSource = {
  sourceImageId: string;
  subject?: CutoutSubject; // 없으면 사람(1단계 스티커)
  target: CutoutTarget;
  outline: boolean;
  eraseStrokes: CutoutStroke[]; // 지움·되살림 획을 시간순으로 담습니다. 저장된 문서와 맞추려고 이름은 그대로 둡니다.
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

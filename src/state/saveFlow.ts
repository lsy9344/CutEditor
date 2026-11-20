import type { SaveLocation } from "./appNotice.ts";
import { getExportExperience } from "../utils/exportBehavior.ts";

export type SaveRoute = "boothy" | "share-sheet" | "picker-first" | "download";
// [다시 저장하기]가 그대로 쓸 처음 저장의 경로·이름·핸들(설계 5.3, UP-3 결정 A)
export type SaveRetry<THandle> = { route: SaveRoute; filename: string; fileHandle: THandle | null };
export type SaveFlowInput<THandle> = { route: SaveRoute; filename: string; retry: SaveRetry<THandle> | null };
export type SaveWritable = { write: (data: Blob) => Promise<void>; close: () => Promise<void> };
export type SaveFlowDeps<THandle> = {
  pickFile: (suggestedName: string) => Promise<THandle>;
  showProgress: () => void;
  render: () => Promise<Blob>;
  saveToBoothy: (blob: Blob) => Promise<boolean>;
  openWritable: (fileHandle: THandle) => Promise<SaveWritable>;
  download: (blob: Blob, filename: string) => void;
  openShareSheet: (blob: Blob, filename: string) => void;
  warn: (message: string, error: unknown) => void;
};
export type SaveFlowResult<THandle> =
  | { kind: "cancelled" }
  | { kind: "share-sheet" }
  | { kind: "done"; location: SaveLocation }
  | { kind: "failed"; error: unknown; retry: SaveRetry<THandle> };
export type SaveRequestStep =
  | { kind: "blocked"; message: string }
  | { kind: "confirm-empty-slots"; emptySlotCount: number }
  | { kind: "save" };

// 누르는 순간의 조건으로 저장 경로를 정합니다(설계 5.2). 데스크톱이 공유로 가지 않게 hasShareFiles는 false로 넘깁니다.
export const getSaveRoute = ({
  expectsBoothySessionSave,
  isMobileLayout,
  hasFilePicker,
}: {
  expectsBoothySessionSave: boolean;
  isMobileLayout: boolean;
  hasFilePicker: boolean;
}): SaveRoute => {
  if (expectsBoothySessionSave) return "boothy";
  const experience = getExportExperience({ hasShareFiles: false, hasFilePicker, prefersTouchExperience: isMobileLayout });
  if (experience === "share-sheet") return "share-sheet";
  if (experience === "save-file-picker") return "picker-first";
  return "download";
};

// 막힐 저장은 빈 칸 확인보다 먼저 알립니다(설계 5.4, UP-9).
export const getSaveRequestStep = ({
  saveBlockedMessage,
  emptySlotCount,
}: {
  saveBlockedMessage: string | null;
  emptySlotCount: number;
}): SaveRequestStep => {
  if (saveBlockedMessage) return { kind: "blocked", message: saveBlockedMessage };
  if (emptySlotCount > 0) return { kind: "confirm-empty-slots", emptySlotCount };
  return { kind: "save" };
};

export const countEmptySlots = ({ slotIds, photoSlotIds }: { slotIds: string[]; photoSlotIds: string[] }): number => {
  const filledSlotIdSet = new Set(photoSlotIds);
  return slotIds.filter((slotId) => !filledSlotIdSet.has(slotId)).length;
};

const padTwo = (value: number): string => String(value).padStart(2, "0");

// 현지 시각 `컷사진_YYYY-MM-DD_HHMMSS.png`. 초까지 넣어 기본 이름끼리 덮어쓰지 않게 합니다(설계 D8).
export const makeSaveFilename = (date: Date): string => {
  const day = `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
  const time = `${padTwo(date.getHours())}${padTwo(date.getMinutes())}${padTwo(date.getSeconds())}`;
  return `컷사진_${day}_${time}.png`;
};

// DOMException이 없는 환경에서도 돌도록 이름만 봅니다.
export const isPickerAbort = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

export const runSaveFlow = async <THandle>(
  { route: requestedRoute, filename: requestedFilename, retry }: SaveFlowInput<THandle>,
  deps: SaveFlowDeps<THandle>,
): Promise<SaveFlowResult<THandle>> => {
  // 다시 저장하기는 지금 배치와 상관없이 처음 저장의 경로·이름·핸들을 씁니다.
  let route = retry?.route ?? requestedRoute;
  const filename = retry?.filename ?? requestedFilename;
  let fileHandle: THandle | null = retry?.fileHandle ?? null;
  let downloadLocation: SaveLocation = "downloads";
  if (route === "picker-first" && fileHandle === null) {
    // 클릭으로 얻은 사용자 활성화가 살아 있을 때 열어야 하므로 이 호출이 첫 await입니다.
    try {
      fileHandle = await deps.pickFile(filename);
    } catch (error) {
      if (isPickerAbort(error)) return { kind: "cancelled" };
      deps.warn("저장 위치 창을 열지 못했어요", error);
      route = "download"; // 다시 저장해도 창을 다시 열지 않습니다
      downloadLocation = "downloads-after-picker-error";
    }
  }
  deps.showProgress();
  let blob: Blob;
  try {
    blob = await deps.render();
  } catch (error) {
    return { kind: "failed", error, retry: { route, filename, fileHandle } };
  }
  if (route === "boothy") {
    let savedToBoothy: boolean;
    try {
      savedToBoothy = await deps.saveToBoothy(blob);
    } catch (error) {
      return { kind: "failed", error, retry: { route, filename, fileHandle: null } };
    }
    if (savedToBoothy) return { kind: "done", location: "boothy" };
    deps.download(blob, filename);
    return { kind: "done", location: "downloads" };
  }
  if (fileHandle !== null) {
    // 핸들이 있으면 공유 화면으로 새지 않고 그 파일에만 씁니다. 열기·쓰기·닫기 어느 것이 실패해도 다운로드합니다.
    try {
      const writable = await deps.openWritable(fileHandle);
      await writable.write(blob);
      await writable.close();
      return { kind: "done", location: "picked" };
    } catch (error) {
      deps.warn("고른 곳에 저장하지 못했어요", error);
      deps.download(blob, filename);
      return { kind: "done", location: "downloads-after-write-error" };
    }
  }
  if (route === "share-sheet") {
    deps.openShareSheet(blob, filename);
    return { kind: "share-sheet" };
  }
  deps.download(blob, filename);
  return { kind: "done", location: downloadLocation };
};

import type { SaveLocation } from "./appNotice.ts";
import type { PhotoImagesState } from "./photoLoadState.ts";
import type { DecorImagesState } from "./decorImagesState.ts";
import type { CutoutImagesState } from "../photo/cutoutTypes.ts";
import { getExportExperience } from "../utils/exportBehavior.ts";

export type SaveRoute = "boothy" | "share-sheet" | "picker-first" | "download";
// [다시 저장하기]가 그대로 쓸 처음 저장의 경로·이름·핸들(설계 5.3, UP-3 결정 A)
export type SaveRetry<THandle> = { route: SaveRoute; filename: string; fileHandle: THandle | null };
export type SaveFlowInput<THandle> = { route: SaveRoute; filename: string; retry: SaveRetry<THandle> | null };
export type SaveWritable = { write: (data: Blob) => Promise<void>; close: () => Promise<void> };
// 렌더 직전 캔버스 준비 판단. waiting은 기다리면 풀리고 failed는 기다려도 풀리지 않습니다. ready는 렌더할 캔버스를 함께 돌려줍니다.
export type CanvasPreparation<TStage> = { kind: "ready"; stage: TStage } | { kind: "waiting" } | { kind: "failed" };
export type SaveFlowDeps<THandle, TStage> = {
  pickFile: (suggestedName: string) => Promise<THandle>;
  showProgress: () => void;
  // 내보내기 모양으로 바꾸고 그려질 때까지 기다린 뒤, 렌더할 캔버스를 그 자리에서 한 번만 읽고 그 캔버스의 준비를 확인합니다.
  // 확인은 이 호출 하나뿐이고, 렌더는 여기서 돌려준 캔버스로만 합니다(UX3-1).
  prepareCanvas: () => Promise<CanvasPreparation<TStage>>;
  // 캔버스를 그리고 PNG로 만듭니다. 마지막 대기 뒤 캔버스가 이미 사라졌으면 캡처하지 않고 null을 돌려줍니다(UX4-1).
  render: (stage: TStage) => Promise<Blob | null>;
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
  // 렌더·쓰기 전에 멈춘 저장(캔버스가 아직 준비 전이거나 렌더 직전에 사라짐). 고른 경로·이름·핸들을 남기므로 준비가 끝난 뒤 다시 저장할 수 있습니다.
  | { kind: "photos-not-ready"; retry: SaveRetry<THandle> }
  | { kind: "photos-failed"; retry: SaveRetry<THandle> }
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

export type CanvasPreparationInput<TStage> = {
  stage: TStage | null; // 렌더할 캔버스
  reportedStage: TStage | null; // 사진·누끼 준비 보고를 마지막으로 낸 캔버스
  reportedUserImages: ReadonlyArray<unknown> | null; // 그 보고가 센 사진 목록
  documentUserImages: ReadonlyArray<unknown>; // 지금 문서의 사진 목록
  photoImagesState: PhotoImagesState;
  cutoutImagesState: CutoutImagesState;
  decorImagesState: DecorImagesState; // 프레임 이미지·색 처리와 일반 스티커
};

// 렌더할 캔버스가 자기 보고로 현재 문서의 사진·누끼·프레임·스티커 준비를 알렸을 때만 ready입니다(UX3-1·UX3-3·UX4-2).
// 새 캔버스의 보고가 오기 전에는 옛 캔버스의 준비 값이 남아 있어도 waiting입니다.
// 프레임 실패는 사진 실패와 같은 failed로 가서 기존 사진 실패 안내를 씁니다(새 문구 없음).
export const getCanvasPreparation = <TStage>({
  stage,
  reportedStage,
  reportedUserImages,
  documentUserImages,
  photoImagesState,
  cutoutImagesState,
  decorImagesState,
}: CanvasPreparationInput<TStage>): CanvasPreparation<TStage> => {
  if (stage === null || reportedStage !== stage) return { kind: "waiting" };
  if (reportedUserImages !== documentUserImages) return { kind: "waiting" };
  if (photoImagesState.kind === "failed" || decorImagesState.kind === "failed") return { kind: "failed" };
  if (photoImagesState.kind === "loading" || cutoutImagesState.kind === "loading" || decorImagesState.kind === "loading") {
    return { kind: "waiting" };
  }
  return { kind: "ready", stage };
};

// 저장하는 동안 배치를 고정해 Stage가 다시 마운트되지 않게 합니다(UX4-1). 고정 값이 있으면 지금 화면 폭을 따르지 않습니다.
export const resolveMobileEditor = ({
  lockedMobileLayout,
  isResponsiveMobile,
}: {
  lockedMobileLayout: boolean | null;
  isResponsiveMobile: boolean;
}): boolean => lockedMobileLayout ?? isResponsiveMobile;

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

export const runSaveFlow = async <THandle, TStage>(
  { route: requestedRoute, filename: requestedFilename, retry }: SaveFlowInput<THandle>,
  deps: SaveFlowDeps<THandle, TStage>,
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
  // 여기서부터 route는 바뀌지 않으므로 멈추거나 실패한 저장의 재시도 정보를 한 번 만듭니다.
  const keptRetry: SaveRetry<THandle> = { route, filename, fileHandle };
  deps.showProgress();
  let blob: Blob;
  try {
    // 사진이 덜 올라온 캔버스로 내보내면 사진 빠진 파일이 성공으로 남습니다. 렌더 직전에 한 번만 확인합니다.
    const canvas = await deps.prepareCanvas();
    if (canvas.kind === "waiting") return { kind: "photos-not-ready", retry: keptRetry };
    if (canvas.kind === "failed") return { kind: "photos-failed", retry: keptRetry };
    const rendered = await deps.render(canvas.stage);
    // 렌더 직전에 캔버스가 사라졌습니다. 쓰지 않고 대기로 끝내 처음 고른 경로·이름·핸들을 남깁니다.
    if (rendered === null) return { kind: "photos-not-ready", retry: keptRetry };
    blob = rendered;
  } catch (error) {
    return { kind: "failed", error, retry: keptRetry };
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

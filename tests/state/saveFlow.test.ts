import test from "node:test";
import assert from "node:assert/strict";

import {
  countEmptySlots,
  countMissingStickers,
  getCanvasPreparation,
  getSaveRequestStep,
  getSaveRoute,
  isPickerAbort,
  makeSaveFilename,
  resolveMobileEditor,
  runSaveFlow,
} from "../../src/state/saveFlow.ts";
import type { CanvasPreparationInput, SaveFlowDeps, SaveRetry, SaveRoute } from "../../src/state/saveFlow.ts";
import type { PhotoImagesState } from "../../src/state/photoLoadState.ts";
import type { DecorImagesState } from "../../src/state/decorImagesState.ts";

type FakeHandle = { name: string };
type FakeStage = { id: string };
const READY_STAGE: FakeStage = { id: "ready-stage" };
const FILENAME = "컷사진_2026-11-20_090507.png";
const namedError = (name: string) => Object.assign(new Error(name), { name });

const makeDeps = (override: (calls: string[]) => Partial<SaveFlowDeps<FakeHandle, FakeStage>> = () => ({})) => {
  const calls: string[] = [];
  const deps: SaveFlowDeps<FakeHandle, FakeStage> = {
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); return { name: suggestedName }; },
    prepareCanvas: async () => ({ kind: "ready", stage: READY_STAGE }),
    showProgress: () => { calls.push("showProgress"); },
    render: async () => { calls.push("render"); return new Blob(["png"], { type: "image/png" }); },
    saveToBoothy: async () => { calls.push("saveToBoothy"); return true; },
    openWritable: async (fileHandle) => {
      calls.push(`openWritable:${fileHandle.name}`);
      return {
        write: async () => { calls.push("write"); },
        close: async () => { calls.push("close"); },
      };
    },
    download: (_blob, filename) => { calls.push(`download:${filename}`); },
    openShareSheet: () => { calls.push("openShareSheet"); },
    warn: (message) => { calls.push(`warn:${message}`); },
    ...override(calls),
  };
  return { calls, deps };
};
const run = (route: SaveRoute, deps: SaveFlowDeps<FakeHandle, FakeStage>, retry: SaveRetry<FakeHandle> | null = null) =>
  runSaveFlow({ route, filename: FILENAME, retry }, deps);
const KEPT_RETRY: SaveRetry<FakeHandle> = { route: "picker-first", filename: "kept-name.png", fileHandle: { name: "kept.png" } };

test("Boothy 저장이 예상되면 휴대폰이어도 창 API가 있어도 boothy 경로다", () => {
  assert.equal(getSaveRoute({ expectsBoothySessionSave: true, isMobileLayout: true, hasFilePicker: true }), "boothy");
});

test("Boothy가 아니고 휴대폰 배치면 share-sheet 경로다", () => {
  assert.equal(getSaveRoute({ expectsBoothySessionSave: false, isMobileLayout: true, hasFilePicker: true }), "share-sheet");
});

test("Boothy·휴대폰이 아니고 저장 위치 창이 있으면 picker-first 경로다", () => {
  assert.equal(getSaveRoute({ expectsBoothySessionSave: false, isMobileLayout: false, hasFilePicker: true }), "picker-first");
});

test("Boothy·휴대폰이 아니고 저장 위치 창이 없으면 download 경로다", () => {
  assert.equal(getSaveRoute({ expectsBoothySessionSave: false, isMobileLayout: false, hasFilePicker: false }), "download");
});

test("빈 칸 수는 사진이 없는 칸만 세고 중복·모르는 칸은 무시한다", () => {
  const slotIds = ["slot-1", "slot-2", "slot-3", "slot-4"];
  assert.equal(countEmptySlots({ slotIds, photoSlotIds: ["slot-2"] }), 3);
  assert.equal(countEmptySlots({ slotIds, photoSlotIds: ["slot-1", "slot-2", "slot-3", "slot-4"] }), 0);
  assert.equal(countEmptySlots({ slotIds, photoSlotIds: ["slot-1", "slot-1", "slot-x"] }), 3);
});

test("파일 이름은 현지 시각의 컷사진_YYYY-MM-DD_HHMMSS.png 모양이다", () => {
  assert.equal(makeSaveFilename(new Date(2026, 10, 20, 9, 5, 7)), "컷사진_2026-11-20_090507.png");
  assert.equal(makeSaveFilename(new Date(2026, 0, 3, 23, 59, 59)), "컷사진_2026-01-03_235959.png");
});

test("같은 분 다른 초의 파일 이름은 서로 다르다", () => {
  const first = makeSaveFilename(new Date(2026, 10, 20, 9, 5, 7));
  const second = makeSaveFilename(new Date(2026, 10, 20, 9, 5, 8));
  assert.notEqual(first, second);
  assert.match(first, /^컷사진_\d{4}-\d{2}-\d{2}_\d{6}\.png$/);
  assert.match(second, /^컷사진_\d{4}-\d{2}-\d{2}_\d{6}\.png$/);
});

test("저장 위치 창 취소는 AbortError 이름의 객체만 취소로 본다", () => {
  assert.equal(isPickerAbort(namedError("AbortError")), true);
  assert.equal(isPickerAbort(namedError("SecurityError")), false);
  assert.equal(isPickerAbort(null), false);
  assert.equal(isPickerAbort("AbortError"), false);
});

test("막힌 저장은 빈 칸 확인보다 먼저 알린다", () => {
  assert.deepEqual(
    getSaveRequestStep({ saveBlockedMessage: "사진을 불러오는 중이에요", emptySlotCount: 2 }),
    { kind: "blocked", message: "사진을 불러오는 중이에요" },
  );
});

test("막히지 않았으면 빈 칸이 있을 때만 확인하고 없으면 바로 저장한다", () => {
  assert.deepEqual(
    getSaveRequestStep({ saveBlockedMessage: null, emptySlotCount: 2 }),
    { kind: "confirm-empty-slots", emptySlotCount: 2 },
  );
  assert.deepEqual(getSaveRequestStep({ saveBlockedMessage: null, emptySlotCount: 0 }), { kind: "save" });
});

test("picker-first는 저장 위치 창 호출이 첫 await이다(호출 직후 동기로 창이 열림)", async () => {
  const { calls, deps } = makeDeps();
  const flow = run("picker-first", deps);
  assert.deepEqual(calls, [`pickFile:${FILENAME}`]);
  await flow;
});

test("picker-first 성공은 창 → 진행 → 렌더 → 쓰기 순서로 고른 곳에 저장하고 다운로드하지 않는다", async () => {
  const { calls, deps } = makeDeps();
  const result = await run("picker-first", deps);
  assert.deepEqual(calls, [`pickFile:${FILENAME}`, "showProgress", "render", `openWritable:${FILENAME}`, "write", "close"]);
  assert.deepEqual(result, { kind: "done", location: "picked" });
});

test("저장 위치 창을 취소하면 진행·렌더·쓰기·다운로드 없이 cancelled로 끝난다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); throw namedError("AbortError"); },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(result, { kind: "cancelled" });
  assert.deepEqual(calls, [`pickFile:${FILENAME}`]);
});

test("저장 위치 창 오류는 알리고 렌더한 뒤 다운로드한다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); throw namedError("SecurityError"); },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls, [
    `pickFile:${FILENAME}`,
    "warn:저장 위치 창을 열지 못했어요",
    "showProgress",
    "render",
    `download:${FILENAME}`,
  ]);
  assert.deepEqual(result, { kind: "done", location: "downloads-after-picker-error" });
});

test("고른 뒤 렌더가 실패하면 처음 경로·이름·핸들을 남기고 쓰기·다운로드를 하지 않는다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    render: async () => { calls.push("render"); throw new Error("render failed"); },
  }));
  const result = await run("picker-first", deps);
  assert.equal(result.kind, "failed");
  if (result.kind !== "failed") return;
  assert.ok(result.error instanceof Error);
  assert.deepEqual(result.retry, { route: "picker-first", filename: FILENAME, fileHandle: { name: FILENAME } });
  assert.deepEqual(calls, [`pickFile:${FILENAME}`, "showProgress", "render"]);
});

test("같은 핸들로 다시 저장하면 창을 열지 않고 그 파일에 쓴다", async () => {
  const { calls, deps } = makeDeps();
  const result = await run("picker-first", deps, KEPT_RETRY);
  assert.deepEqual(calls, ["showProgress", "render", "openWritable:kept.png", "write", "close"]);
  assert.deepEqual(result, { kind: "done", location: "picked" });
});

// UX3-1·UX3-3: 확인은 렌더 직전 한 번이다. 두 프레임 기다린 뒤 읽은 캔버스 하나를 확인하고 그 캔버스로 렌더한다.
test("진행 안내 뒤에 렌더할 캔버스를 한 번 준비·확인하고 그다음 렌더한다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    prepareCanvas: async () => { calls.push("prepareCanvas"); return { kind: "ready", stage: READY_STAGE }; },
  }));
  await run("picker-first", deps);
  assert.deepEqual(calls.slice(0, 4), [`pickFile:${FILENAME}`, "showProgress", "prepareCanvas", "render"]);
  assert.equal(calls.filter((call) => call === "prepareCanvas").length, 1);
});

test("렌더 함수에는 확인한 바로 그 캔버스 객체를 넘긴다", async () => {
  const checkedStage: FakeStage = { id: "checked-stage" };
  const otherStage: FakeStage = { id: "other-stage" };
  const rendered: FakeStage[] = [];
  const { deps } = makeDeps(() => ({
    prepareCanvas: async () => ({ kind: "ready", stage: checkedStage }),
    render: async (stage) => { rendered.push(stage); return new Blob(["png"], { type: "image/png" }); },
  }));
  await run("picker-first", deps);
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0], checkedStage);
  assert.notEqual(rendered[0], otherStage);
});

test("렌더 직전 확인에서 사진이 준비되지 않았으면 렌더·쓰기·다운로드 없이 멈추고 고른 핸들을 남긴다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    prepareCanvas: async () => { calls.push("prepareCanvas"); return { kind: "waiting" }; },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls, [`pickFile:${FILENAME}`, "showProgress", "prepareCanvas"]);
  assert.deepEqual(result, {
    kind: "photos-not-ready",
    retry: { route: "picker-first", filename: FILENAME, fileHandle: { name: FILENAME } },
  });
});

test("사진을 불러오지 못한 캔버스도 렌더·쓰기 없이 멈추고 고른 핸들을 남긴다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    prepareCanvas: async () => { calls.push("prepareCanvas"); return { kind: "failed" }; },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls, [`pickFile:${FILENAME}`, "showProgress", "prepareCanvas"]);
  assert.deepEqual(result, {
    kind: "photos-failed",
    retry: { route: "picker-first", filename: FILENAME, fileHandle: { name: FILENAME } },
  });
});

test("캔버스를 준비하다 던지면 failed와 고른 핸들을 남기고 렌더하지 않는다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    prepareCanvas: async () => { calls.push("prepareCanvas"); throw new Error("prepare failed"); },
  }));
  const result = await run("picker-first", deps);
  assert.equal(result.kind, "failed");
  if (result.kind !== "failed") return;
  assert.deepEqual(result.retry, { route: "picker-first", filename: FILENAME, fileHandle: { name: FILENAME } });
  assert.deepEqual(calls, [`pickFile:${FILENAME}`, "showProgress", "prepareCanvas"]);
});

test("새 캔버스까지 다 준비됐으면 위치 창을 한 번만 열고 한 번에 그 파일에 저장한다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); return { name: "picked.png" }; },
    prepareCanvas: async () => { calls.push("prepareCanvas"); return { kind: "ready", stage: { id: "new-stage" } }; },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls, [
    `pickFile:${FILENAME}`,
    "showProgress",
    "prepareCanvas",
    "render",
    "openWritable:picked.png",
    "write",
    "close",
  ]);
  assert.deepEqual(result, { kind: "done", location: "picked" });
});

test("준비가 끝난 뒤 다시 저장하면 창을 다시 열지 않고 멈췄던 때 고른 핸들에 쓴다", async () => {
  let preparation: "waiting" | "ready" = "waiting";
  const { calls, deps } = makeDeps((calls) => ({
    prepareCanvas: async () => (preparation === "ready"
      ? { kind: "ready", stage: READY_STAGE }
      : { kind: "waiting" }),
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); return { name: "picked.png" }; },
  }));
  const stopped = await run("picker-first", deps);
  assert.equal(stopped.kind, "photos-not-ready");
  if (stopped.kind !== "photos-not-ready") return;

  preparation = "ready";
  calls.length = 0;
  const result = await run("picker-first", deps, stopped.retry);
  assert.deepEqual(calls, ["showProgress", "render", "openWritable:picked.png", "write", "close"]);
  assert.deepEqual(result, { kind: "done", location: "picked" });
});

test("준비가 안 됐고 아직 고른 핸들이 없던 경로(Boothy·공유·다운로드)도 렌더 전에 멈추고 그 경로를 남긴다", async () => {
  for (const route of ["boothy", "share-sheet", "download"] as const) {
    const { calls, deps } = makeDeps(() => ({ prepareCanvas: async () => ({ kind: "waiting" }) }));
    const result = await run(route, deps);
    assert.deepEqual(result, { kind: "photos-not-ready", retry: { route, filename: FILENAME, fileHandle: null } }, route);
    assert.deepEqual(calls, ["showProgress"], route);
  }
});

test("저장 위치 창을 취소하면 캔버스를 준비하지 않는다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); throw namedError("AbortError"); },
    prepareCanvas: async () => { calls.push("prepareCanvas"); return { kind: "waiting" }; },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(result, { kind: "cancelled" });
  assert.deepEqual(calls, [`pickFile:${FILENAME}`]);
});

// 준비 판단(순수 함수): 렌더할 캔버스와 그 캔버스가 낸 준비 보고를 함께 봅니다.
const PHOTO_LIST = [{ id: "photo-1" }];
const preparationInput = (override: Partial<CanvasPreparationInput<FakeStage>> = {}): CanvasPreparationInput<FakeStage> => ({
  stage: READY_STAGE,
  reportedStage: READY_STAGE,
  reportedUserImages: PHOTO_LIST,
  documentUserImages: PHOTO_LIST,
  photoImagesState: { kind: "ready" },
  cutoutImagesState: { kind: "ready" },
  decorImagesState: { kind: "ready", failedStickerCount: 0 },
  ...override,
});

test("렌더할 캔버스가 보고한 사진·누끼가 모두 준비됐으면 그 캔버스와 함께 ready다", () => {
  const preparation = getCanvasPreparation(preparationInput());
  assert.deepEqual(preparation, { kind: "ready", stage: READY_STAGE });
  assert.ok(preparation.kind === "ready" && preparation.stage === READY_STAGE, "렌더할 캔버스 객체를 그대로 돌려주지 않습니다");
});

test("새 캔버스의 보고가 아직 없으면 옛 캔버스가 준비였어도 waiting이다(UX3-1)", () => {
  const newStage: FakeStage = { id: "new-stage" };
  assert.deepEqual(getCanvasPreparation(preparationInput({ stage: newStage, reportedStage: READY_STAGE })), { kind: "waiting" });
  assert.deepEqual(getCanvasPreparation(preparationInput({ stage: newStage, reportedStage: null })), { kind: "waiting" });
});

test("새 캔버스가 자기 보고로 준비를 알렸으면 클릭 때와 다른 캔버스여도 그 캔버스로 ready다(UX3-3)", () => {
  const newStage: FakeStage = { id: "new-stage" };
  const preparation = getCanvasPreparation(preparationInput({ stage: newStage, reportedStage: newStage }));
  assert.ok(preparation.kind === "ready" && preparation.stage === newStage);
});

test("렌더할 캔버스가 없으면 waiting이다", () => {
  assert.deepEqual(getCanvasPreparation(preparationInput({ stage: null })), { kind: "waiting" });
});

test("보고한 사진 목록이 지금 문서의 목록과 다르면 waiting이다", () => {
  assert.deepEqual(getCanvasPreparation(preparationInput({ documentUserImages: [{ id: "photo-1" }] })), { kind: "waiting" });
  assert.deepEqual(getCanvasPreparation(preparationInput({ reportedUserImages: null })), { kind: "waiting" });
});

test("사진이나 누끼를 불러오는 중이면 waiting이다", () => {
  assert.deepEqual(getCanvasPreparation(preparationInput({ photoImagesState: { kind: "loading" } })), { kind: "waiting" });
  assert.deepEqual(getCanvasPreparation(preparationInput({ cutoutImagesState: { kind: "loading" } })), { kind: "waiting" });
});

test("사진을 불러오지 못했으면 failed이고 누끼를 기다리는 중이어도 failed다", () => {
  const failedPhotos: PhotoImagesState = { kind: "failed", imageIds: ["photo-1"] };
  assert.deepEqual(getCanvasPreparation(preparationInput({ photoImagesState: failedPhotos })), { kind: "failed" });
  assert.deepEqual(
    getCanvasPreparation(preparationInput({ photoImagesState: failedPhotos, cutoutImagesState: { kind: "loading" } })),
    { kind: "failed" },
  );
});

test("다른 캔버스가 보고한 사진 실패는 이 캔버스의 실패로 세지 않는다", () => {
  const failedPhotos: PhotoImagesState = { kind: "failed", imageIds: ["photo-1"] };
  assert.deepEqual(
    getCanvasPreparation(preparationInput({ stage: { id: "new-stage" }, photoImagesState: failedPhotos })),
    { kind: "waiting" },
  );
});

test("프레임 이미지를 불러오는 중이면 사진이 준비됐어도 waiting이다(UX4-2)", () => {
  assert.deepEqual(getCanvasPreparation(preparationInput({ decorImagesState: { kind: "loading" } })), { kind: "waiting" });
});

test("프레임 이미지를 읽지 못했으면 기존 실패 흐름으로 가도록 failed다(UX4-2)", () => {
  const failedDecor: DecorImagesState = { kind: "failed" };
  assert.deepEqual(getCanvasPreparation(preparationInput({ decorImagesState: failedDecor })), { kind: "failed" });
  assert.deepEqual(
    getCanvasPreparation(preparationInput({ decorImagesState: failedDecor, cutoutImagesState: { kind: "loading" } })),
    { kind: "failed" },
  );
});

test("프레임·스티커 보고가 오기 전의 새 캔버스는 사진이 준비됐어도 waiting이다(UX4-2)", () => {
  const newStage: FakeStage = { id: "new-stage" };
  assert.deepEqual(
    getCanvasPreparation(preparationInput({ stage: newStage, reportedStage: READY_STAGE, decorImagesState: { kind: "ready", failedStickerCount: 0 } })),
    { kind: "waiting" },
  );
});

test("누끼 불러오기 실패는 저장을 막지 않는다(없는 스티커로 알림)", () => {
  const preparation = getCanvasPreparation(
    preparationInput({ cutoutImagesState: { kind: "failed", stickerIds: ["sticker-1"] } }),
  );
  assert.equal(preparation.kind, "ready");
});

// UX5-4: 저장 그림에 들어가지 않는 스티커 수는 누끼 스티커와 일반 스티커의 영구 실패를 합칩니다.
test("누락 스티커 수는 누끼 실패와 일반 스티커 실패를 합친다", () => {
  assert.equal(
    countMissingStickers({ cutoutImagesState: { kind: "failed", stickerIds: ["cutout-1"] }, decorImagesState: { kind: "ready", failedStickerCount: 1 } }),
    2,
  );
});

test("누락 스티커 수는 한쪽만 실패해도 그 수이고 둘 다 정상이면 0이다", () => {
  const readyDecor: DecorImagesState = { kind: "ready", failedStickerCount: 0 };
  assert.equal(countMissingStickers({ cutoutImagesState: { kind: "failed", stickerIds: ["a", "b"] }, decorImagesState: readyDecor }), 2);
  assert.equal(countMissingStickers({ cutoutImagesState: { kind: "ready" }, decorImagesState: { kind: "ready", failedStickerCount: 3 } }), 3);
  assert.equal(countMissingStickers({ cutoutImagesState: { kind: "ready" }, decorImagesState: readyDecor }), 0);
});

test("누락 스티커 수는 일반 스티커 실패 수를 ready 보고에서만 읽는다", () => {
  assert.equal(countMissingStickers({ cutoutImagesState: { kind: "ready" }, decorImagesState: { kind: "loading" } }), 0);
});

test("고른 파일을 열지 못하면 알리고 다운로드하며 쓰기·닫기는 하지 않는다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    openWritable: async (fileHandle) => {
      calls.push(`openWritable:${fileHandle.name}`);
      throw namedError("NotAllowedError");
    },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls.slice(-3), [`openWritable:${FILENAME}`, "warn:고른 곳에 저장하지 못했어요", `download:${FILENAME}`]);
  assert.equal(calls.includes("write"), false);
  assert.equal(calls.includes("close"), false);
  assert.deepEqual(result, { kind: "done", location: "downloads-after-write-error" });
});

test("boothy 저장이 되면 창·다운로드 없이 boothy로 끝난다", async () => {
  const { calls, deps } = makeDeps();
  const result = await run("boothy", deps);
  assert.deepEqual(calls, ["showProgress", "render", "saveToBoothy"]);
  assert.deepEqual(result, { kind: "done", location: "boothy" });
});

test("boothy가 저장하지 않았다고 답하면 다운로드한다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    saveToBoothy: async () => { calls.push("saveToBoothy"); return false; },
  }));
  const result = await run("boothy", deps);
  assert.deepEqual(calls.slice(-1), [`download:${FILENAME}`]);
  assert.deepEqual(result, { kind: "done", location: "downloads" });
});

test("boothy 저장이 던지면 failed와 boothy 재시도 정보를 남기고 다운로드하지 않는다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    saveToBoothy: async () => { calls.push("saveToBoothy"); throw new Error("host down"); },
  }));
  const result = await run("boothy", deps);
  assert.equal(result.kind, "failed");
  if (result.kind !== "failed") return;
  assert.deepEqual(result.retry, { route: "boothy", filename: FILENAME, fileHandle: null });
  assert.equal(calls.some((call) => call.startsWith("download:")), false);
});

test("share-sheet는 진행 → 렌더 → 공유 화면 열기로 끝난다", async () => {
  const { calls, deps } = makeDeps();
  const result = await run("share-sheet", deps);
  assert.deepEqual(calls, ["showProgress", "render", "openShareSheet"]);
  assert.deepEqual(result, { kind: "share-sheet" });
});

test("download 경로는 창 없이 진행 → 렌더 → 다운로드한다", async () => {
  const { calls, deps } = makeDeps();
  const result = await run("download", deps);
  assert.deepEqual(calls, ["showProgress", "render", `download:${FILENAME}`]);
  assert.deepEqual(result, { kind: "done", location: "downloads" });
});

test("download 경로에서 렌더가 실패하면 download 재시도 정보를 남긴다", async () => {
  const { deps } = makeDeps((calls) => ({
    render: async () => { calls.push("render"); throw new Error("render failed"); },
  }));
  const result = await run("download", deps);
  assert.equal(result.kind, "failed");
  if (result.kind !== "failed") return;
  assert.deepEqual(result.retry, { route: "download", filename: FILENAME, fileHandle: null });
});

test("쓰기가 실패하면 알리고 다운로드하며 닫기·picked로 끝나지 않는다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    openWritable: async (fileHandle) => {
      calls.push(`openWritable:${fileHandle.name}`);
      return {
        write: async () => { calls.push("write"); throw namedError("NotAllowedError"); },
        close: async () => { calls.push("close"); },
      };
    },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls.slice(-4), [`openWritable:${FILENAME}`, "write", "warn:고른 곳에 저장하지 못했어요", `download:${FILENAME}`]);
  assert.equal(calls.includes("close"), false);
  assert.deepEqual(result, { kind: "done", location: "downloads-after-write-error" });
});

test("닫기가 실패하면 알리고 다운로드한다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    openWritable: async (fileHandle) => {
      calls.push(`openWritable:${fileHandle.name}`);
      return {
        write: async () => { calls.push("write"); },
        close: async () => { calls.push("close"); throw namedError("NotAllowedError"); },
      };
    },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls.slice(-4), ["write", "close", "warn:고른 곳에 저장하지 못했어요", `download:${FILENAME}`]);
  assert.deepEqual(result, { kind: "done", location: "downloads-after-write-error" });
});

test("배치가 바뀐 뒤 다시 저장해도 남은 핸들에 쓰고 공유 화면·창을 열지 않는다", async () => {
  const { calls, deps } = makeDeps();
  const result = await run("share-sheet", deps, KEPT_RETRY);
  assert.deepEqual(calls, ["showProgress", "render", "openWritable:kept.png", "write", "close"]);
  assert.deepEqual(result, { kind: "done", location: "picked" });

  const failing = makeDeps((failingCalls) => ({
    openWritable: async (fileHandle) => {
      failingCalls.push(`openWritable:${fileHandle.name}`);
      throw namedError("NotAllowedError");
    },
  }));
  await run("share-sheet", failing.deps, KEPT_RETRY);
  assert.deepEqual(failing.calls.slice(-1), ["download:kept-name.png"]);
  assert.equal(failing.calls.some((call) => call.startsWith("pickFile") || call.startsWith("openShareSheet")), false);

  // 남은 정보의 경로가 share-sheet여도 핸들이 있으면 공유 화면보다 그 파일에 쓰기가 먼저다
  const shareWithHandle = makeDeps();
  await run("picker-first", shareWithHandle.deps, { route: "share-sheet", filename: "kept-name.png", fileHandle: { name: "kept.png" } });
  assert.deepEqual(shareWithHandle.calls, ["showProgress", "render", "openWritable:kept.png", "write", "close"]);
});

test("다시 저장도 렌더가 실패하면 같은 핸들과 처음 이름을 계속 남긴다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    render: async () => { calls.push("render"); throw new Error("render failed"); },
  }));
  const result = await run("picker-first", deps, KEPT_RETRY);
  assert.equal(result.kind, "failed");
  if (result.kind !== "failed") return;
  assert.equal(result.retry.fileHandle, KEPT_RETRY.fileHandle);
  assert.equal(result.retry.filename, "kept-name.png");
  assert.deepEqual(calls, ["showProgress", "render"]);
});

test("창 오류 뒤 렌더가 실패하면 download 재시도 정보를 남기고 다시 저장해도 창을 열지 않는다", async () => {
  const { deps } = makeDeps((calls) => ({
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); throw namedError("SecurityError"); },
    render: async () => { calls.push("render"); throw new Error("render failed"); },
  }));
  const result = await run("picker-first", deps);
  assert.equal(result.kind, "failed");
  if (result.kind !== "failed") return;
  assert.deepEqual(result.retry, { route: "download", filename: FILENAME, fileHandle: null });

  const retried = makeDeps();
  await run("picker-first", retried.deps, result.retry);
  assert.deepEqual(retried.calls, ["showProgress", "render", `download:${FILENAME}`]);
});

test("휴대폰 실패 뒤 넓은 화면에서 다시 저장해도 공유 화면으로 간다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    openShareSheet: (_blob, filename) => { calls.push(`openShareSheet:${filename}`); },
  }));
  const result = await run("picker-first", deps, { route: "share-sheet", filename: "kept-name.png", fileHandle: null });
  assert.deepEqual(calls, ["showProgress", "render", "openShareSheet:kept-name.png"]);
  assert.deepEqual(result, { kind: "share-sheet" });
});

// UX4-1: 렌더가 마지막 대기 뒤 캔버스가 이미 사라진 것을 알리면(null) 쓰기 전에 멈추고 경로·이름·핸들을 남깁니다.
test("렌더가 캔버스가 사라졌다고 알리면 쓰기 없이 photos-not-ready와 재시도 정보로 끝난다", async () => {
  for (const route of ["boothy", "share-sheet", "download", "picker-first"] as const) {
    const { calls, deps } = makeDeps((calls) => ({
      render: async () => { calls.push("render"); return null; },
    }));
    const result = await run(route, deps);
    const expectedHandle = route === "picker-first" ? { name: FILENAME } : null;
    assert.deepEqual(result, { kind: "photos-not-ready", retry: { route, filename: FILENAME, fileHandle: expectedHandle } }, route);
    for (const forbidden of ["saveToBoothy", "write", "close", "openShareSheet"]) {
      assert.equal(calls.includes(forbidden), false, `${route}: ${forbidden}를 불렀습니다`);
    }
    assert.equal(calls.some((call) => call.startsWith("download:") || call.startsWith("openWritable:")), false, route);
  }
});

test("캔버스가 사라져 멈춘 저장도 다시 저장하면 처음 고른 핸들로 쓴다", async () => {
  const first = makeDeps((calls) => ({ render: async () => { calls.push("render"); return null; } }));
  const stopped = await run("picker-first", first.deps);
  assert.equal(stopped.kind, "photos-not-ready");
  if (stopped.kind !== "photos-not-ready") return;
  const second = makeDeps();
  const result = await run("download", second.deps, stopped.retry);
  assert.equal(second.calls.some((call) => call.startsWith("pickFile:")), false, "위치 창을 다시 열었습니다");
  assert.deepEqual(second.calls.slice(-3), [`openWritable:${FILENAME}`, "write", "close"]);
  assert.deepEqual(result, { kind: "done", location: "picked" });
});

// UX4-1: 저장하는 동안 배치를 고정합니다. 고정 값이 있으면 지금 화면 폭의 배치를 따르지 않습니다.
test("배치를 고정한 동안에는 화면 폭이 바뀌어도 고정한 배치를 쓴다", () => {
  assert.equal(resolveMobileEditor({ lockedMobileLayout: false, isResponsiveMobile: true }), false);
  assert.equal(resolveMobileEditor({ lockedMobileLayout: true, isResponsiveMobile: false }), true);
});

test("고정이 풀리면(null) 지금 화면 폭의 배치로 돌아간다", () => {
  assert.equal(resolveMobileEditor({ lockedMobileLayout: null, isResponsiveMobile: true }), true);
  assert.equal(resolveMobileEditor({ lockedMobileLayout: null, isResponsiveMobile: false }), false);
});

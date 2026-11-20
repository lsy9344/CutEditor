import test from "node:test";
import assert from "node:assert/strict";

import { countEmptySlots, getSaveRequestStep, getSaveRoute, isPickerAbort, makeSaveFilename, runSaveFlow } from "../../src/state/saveFlow.ts";
import type { SaveFlowDeps, SaveRetry, SaveRoute } from "../../src/state/saveFlow.ts";

type FakeHandle = { name: string };
const FILENAME = "컷사진_2026-11-20_090507.png";
const namedError = (name: string) => Object.assign(new Error(name), { name });

const makeDeps = (override: (calls: string[]) => Partial<SaveFlowDeps<FakeHandle>> = () => ({})) => {
  const calls: string[] = [];
  const deps: SaveFlowDeps<FakeHandle> = {
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); return { name: suggestedName }; },
    isCanvasReady: () => true,
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
const run = (route: SaveRoute, deps: SaveFlowDeps<FakeHandle>, retry: SaveRetry<FakeHandle> | null = null) =>
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

// UX2-1: 저장 위치 창이 열린 사이 캔버스가 바뀔 수 있으므로, 창이 돌아온 뒤 렌더할 캔버스의 사진 준비를 다시 확인한다.
test("저장 위치 창이 돌아온 뒤에 준비를 확인한다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    isCanvasReady: () => { calls.push("isCanvasReady"); return true; },
  }));
  await run("picker-first", deps);
  assert.deepEqual(calls.slice(0, 3), [`pickFile:${FILENAME}`, "isCanvasReady", "showProgress"]);
});

test("창이 돌아온 뒤 사진이 준비되지 않았으면 진행·렌더·쓰기·다운로드 없이 멈추고 고른 핸들을 남긴다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    isCanvasReady: () => { calls.push("isCanvasReady"); return false; },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(calls, [`pickFile:${FILENAME}`, "isCanvasReady"]);
  assert.deepEqual(result, {
    kind: "photos-not-ready",
    retry: { route: "picker-first", filename: FILENAME, fileHandle: { name: FILENAME } },
  });
});

test("준비가 끝난 뒤 다시 저장하면 창을 다시 열지 않고 멈췄던 때 고른 핸들에 쓴다", async () => {
  let isReady = false;
  const { calls, deps } = makeDeps((calls) => ({
    isCanvasReady: () => isReady,
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); return { name: "picked.png" }; },
  }));
  const stopped = await run("picker-first", deps);
  assert.equal(stopped.kind, "photos-not-ready");
  if (stopped.kind !== "photos-not-ready") return;

  isReady = true;
  calls.length = 0;
  const result = await run("picker-first", deps, stopped.retry);
  assert.deepEqual(calls, ["showProgress", "render", "openWritable:picked.png", "write", "close"]);
  assert.deepEqual(result, { kind: "done", location: "picked" });
});

test("준비가 안 됐고 아직 고른 핸들이 없던 경로(Boothy·공유·다운로드)도 렌더 전에 멈추고 그 경로를 남긴다", async () => {
  for (const route of ["boothy", "share-sheet", "download"] as const) {
    const { calls, deps } = makeDeps(() => ({ isCanvasReady: () => false }));
    const result = await run(route, deps);
    assert.deepEqual(result, { kind: "photos-not-ready", retry: { route, filename: FILENAME, fileHandle: null } }, route);
    assert.deepEqual(calls, [], route);
  }
});

test("저장 위치 창을 취소하면 준비를 확인하지 않는다", async () => {
  const { calls, deps } = makeDeps((calls) => ({
    pickFile: async (suggestedName) => { calls.push(`pickFile:${suggestedName}`); throw namedError("AbortError"); },
    isCanvasReady: () => { calls.push("isCanvasReady"); return false; },
  }));
  const result = await run("picker-first", deps);
  assert.deepEqual(result, { kind: "cancelled" });
  assert.deepEqual(calls, [`pickFile:${FILENAME}`]);
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

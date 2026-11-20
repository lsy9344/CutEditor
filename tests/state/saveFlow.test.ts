import test from "node:test";
import assert from "node:assert/strict";

import { countEmptySlots, getSaveRequestStep, getSaveRoute, isPickerAbort, makeSaveFilename } from "../../src/state/saveFlow.ts";

const namedError = (name: string) => Object.assign(new Error(name), { name });

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

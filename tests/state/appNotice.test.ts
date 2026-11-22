import test from "node:test";
import assert from "node:assert/strict";

import {
  SAVE_DONE_NEXT_STEP,
  getInlineStatusView,
  getNoticeView,
  splitPhotosByFrame,
} from "../../src/state/appNotice.ts";
import type { AppNotice, InlineStatus, SaveLocation } from "../../src/state/appNotice.ts";
import { PHOTO_FAILED_SAVE_MESSAGE, PHOTO_LOADING_SAVE_MESSAGE } from "../../src/state/photoLoadState.ts";
import { CUTOUT_COPY } from "../../src/photo/cutoutCopy.ts";

const SAVE_LOCATIONS: SaveLocation[] = ["picked", "downloads", "downloads-after-picker-error", "downloads-after-write-error", "boothy"];

const RULE_NOTICES: AppNotice[] = [
  { kind: "frame-change", frameType: "4v_1" },
  { kind: "frame-change", frameType: "2h" },
  { kind: "empty-slots", emptySlotCount: 3 },
  { kind: "save-progress" },
  ...SAVE_LOCATIONS.map((location): AppNotice => ({ kind: "save-done", location, missingStickerCount: 1 })),
  { kind: "save-failed", hasPickedFile: false, isWaitingForPhotos: false },
  { kind: "save-failed", hasPickedFile: true, isWaitingForPhotos: false },
  { kind: "save-failed", hasPickedFile: false, isWaitingForPhotos: true },
];

const RULE_STATUSES: InlineStatus[] = [
  { kind: "save-cancelled" },
  { kind: "save-blocked", message: PHOTO_LOADING_SAVE_MESSAGE },
  { kind: "save-blocked", message: PHOTO_FAILED_SAVE_MESSAGE },
  { kind: "save-blocked", message: CUTOUT_COPY.exportBlocked },
  { kind: "import-failed" },
];

const FORBIDDEN_WORDS = ["실패", "오류", "세션", "내보내기"];

test("프레임 바꾸기 확인은 빠지는 사진이 없으면 그대로 있다는 문장을 보인다", () => {
  const view = getNoticeView({ kind: "frame-change", frameType: "4v_1" }, 0);

  assert.equal(view.title, "프레임을 바꿀까요?");
  assert.deepEqual(view.lines, [
    "사진과 글씨, 스티커는 그대로 있어요.",
    "바꾸고 나면 되돌리기로 지금 프레임에 돌아올 수 없어요.",
  ]);
  assert.equal(view.tone, "warning");
});

test("프레임 바꾸기 확인은 빠지는 사진 수를 문장에 넣는다", () => {
  const view = getNoticeView({ kind: "frame-change", frameType: "2h" }, 2);

  assert.deepEqual(view.lines, [
    "새 프레임에 없는 칸의 사진 2장은 빠져요.",
    "나머지 사진과 글씨, 스티커는 그대로 있어요.",
    "바꾸고 나면 되돌리기로 지금 프레임에 돌아올 수 없어요.",
  ]);
});

test("프레임 바꾸기 확인은 버튼 둘이고 그대로 두기로 닫힌다", () => {
  const view = getNoticeView({ kind: "frame-change", frameType: "4v_1" }, 0);

  assert.deepEqual(view.actions, [
    { id: "keep-frame", label: "그대로 두기", isPrimary: false },
    { id: "change-frame", label: "프레임 바꾸기", isPrimary: true },
  ]);
  assert.equal(view.closeActionId, "keep-frame");
  assert.equal(view.isBusy, false);
});

test("빈 칸 확인은 칸 수를 제목에 넣고 사진 더 넣기로 닫힌다", () => {
  const view = getNoticeView({ kind: "empty-slots", emptySlotCount: 3 });

  assert.equal(view.title, "빈 칸이 3개 있어요");
  assert.deepEqual(view.lines, ["빈 칸은 사진 없이 저장돼요."]);
  assert.deepEqual(view.actions, [
    { id: "add-photos", label: "사진 더 넣기", isPrimary: false },
    { id: "save-anyway", label: "빈 칸 그대로 저장하기", isPrimary: true },
  ]);
  assert.equal(view.closeActionId, "add-photos");
  assert.equal(view.tone, "warning");
});

test("저장 준비 중 안내는 버튼 없이 기다리게 하고 닫을 수 없다", () => {
  const view = getNoticeView({ kind: "save-progress" });

  assert.equal(view.title, "저장 준비 중이에요");
  assert.deepEqual(view.lines, ["잠시만 기다려 주세요."]);
  assert.deepEqual(view.actions, []);
  assert.equal(view.isBusy, true);
  assert.equal(view.closeActionId, null);
  assert.equal(view.tone, "info");
});

test("저장했어요 안내는 고른 곳 문장과 닫기 버튼 하나를 보인다", () => {
  const view = getNoticeView({ kind: "save-done", location: "picked", missingStickerCount: 0 });

  assert.equal(view.title, "저장했어요");
  assert.deepEqual(view.lines, ["고른 곳에 저장했어요."]);
  assert.equal(view.tone, "success");
  assert.deepEqual(view.actions, [{ id: "close", label: "닫기", isPrimary: true }]);
  assert.equal(view.closeActionId, "close");
});

test("저장 장소별 문장이 설계와 같고 쓰기 실패 뒤 다운로드만 성공으로 보이지 않는다", () => {
  const expectedFirstLines: Record<SaveLocation, string> = {
    picked: "고른 곳에 저장했어요.",
    downloads: "다운로드 폴더에 저장했어요.",
    "downloads-after-picker-error": "저장할 곳을 고르지 못해서 다운로드 폴더에 저장했어요.",
    "downloads-after-write-error": "대신 다운로드 폴더에 저장했어요.",
    boothy: "오늘 찍은 사진과 같은 곳에 저장했어요.",
  };

  for (const location of SAVE_LOCATIONS) {
    const view = getNoticeView({ kind: "save-done", location, missingStickerCount: 0 });

    assert.equal(view.lines[0], expectedFirstLines[location], location);
    if (location === "downloads-after-write-error") {
      assert.equal(view.title, "고른 곳에 저장하지 못했어요", location);
      assert.equal(view.tone, "warning", location);
      assert.equal(view.lines[1], "고른 곳에는 빈 파일이 남았을 수 있어요.", location);
      continue;
    }
    assert.equal(view.title, "저장했어요", location);
    assert.equal(view.tone, "success", location);
  }
});

test("저장했어요 안내는 빠진 스티커가 있으면 기존 스티커 문장을 더한다", () => {
  const view = getNoticeView({ kind: "save-done", location: "picked", missingStickerCount: 2 });

  assert.equal(view.lines[1], CUTOUT_COPY.missingStickers(2));
});

test("다음에 할 일 문장은 아직 없고 저장했어요 문장은 장소 문장만 보인다", () => {
  assert.equal(SAVE_DONE_NEXT_STEP, null);

  for (const location of SAVE_LOCATIONS) {
    const view = getNoticeView({ kind: "save-done", location, missingStickerCount: 0 });
    const expectedLineCount = location === "downloads-after-write-error" ? 2 : 1;

    assert.equal(view.lines.length, expectedLineCount, location);
  }
});

test("저장하지 못했어요 안내는 고른 파일이 없으면 다시 저장하기와 직원 호출을 알린다", () => {
  const view = getNoticeView({ kind: "save-failed", hasPickedFile: false, isWaitingForPhotos: false });

  assert.equal(view.title, "사진을 저장하지 못했어요");
  assert.deepEqual(view.lines, ["[다시 저장하기]를 눌러 주세요.", "계속 안 되면 직원을 불러 주세요."]);
  assert.equal(view.tone, "error");
  assert.deepEqual(view.actions, [
    { id: "close", label: "닫기", isPrimary: false },
    { id: "retry-save", label: "다시 저장하기", isPrimary: true },
  ]);
  assert.equal(view.closeActionId, "close");
});

test("저장하지 못했어요 안내는 고른 파일이 있으면 같은 파일에 다시 저장한다고 알린다", () => {
  const view = getNoticeView({ kind: "save-failed", hasPickedFile: true, isWaitingForPhotos: false });

  assert.deepEqual(view.lines, [
    "고른 파일은 아직 비어 있어요.",
    "[다시 저장하기]를 누르면 같은 파일에 다시 저장해요.",
    "계속 안 되면 직원을 불러 주세요.",
  ]);
  assert.deepEqual(view.actions, [
    { id: "close", label: "닫기", isPrimary: false },
    { id: "retry-save", label: "다시 저장하기", isPrimary: true },
  ]);
});

test("저장 취소는 상태 줄에 정보 문장 하나로 보인다", () => {
  assert.deepEqual(getInlineStatusView({ kind: "save-cancelled" }), { tone: "info", lines: ["저장을 취소했어요."] });
});

test("저장 막힘은 받은 문구를 그대로 경고 문장으로 보인다", () => {
  assert.deepEqual(getInlineStatusView({ kind: "save-blocked", message: PHOTO_LOADING_SAVE_MESSAGE }), {
    tone: "warning",
    lines: [PHOTO_LOADING_SAVE_MESSAGE],
  });
});

test("가져오기 실패는 호스트 문구 없이 늘 같은 일반 문장 셋을 보인다", () => {
  assert.deepEqual(getInlineStatusView({ kind: "import-failed" }), {
    tone: "error",
    lines: ["오늘 찍은 사진을 불러오지 못했어요.", "칸을 다시 눌러 주세요.", "계속 안 되면 직원을 불러 주세요."],
  });
});

test("모든 안내는 주 버튼 0~1개, 닫기 규칙, 금지 낱말 없음을 지킨다", () => {
  for (const notice of RULE_NOTICES) {
    for (const droppedPhotoCount of [0, 2]) {
      const view = getNoticeView(notice, droppedPhotoCount);
      const label = JSON.stringify({ notice, droppedPhotoCount });

      assert.ok(view.actions.filter((action) => action.isPrimary).length <= 1, `${label}: 주 버튼`);
      if (view.closeActionId !== null) {
        assert.ok(view.actions.some((action) => action.id === view.closeActionId), `${label}: closeActionId`);
      }
      assert.equal(view.isBusy, notice.kind === "save-progress", `${label}: isBusy`);
      for (const action of view.actions) {
        assert.ok(!action.label.includes("확인") && !action.label.includes("취소"), `${label}: 버튼 이름 ${action.label}`);
      }
      for (const text of [view.title, ...view.lines, ...view.actions.map((action) => action.label)]) {
        for (const word of FORBIDDEN_WORDS) {
          assert.ok(!text.includes(word), `${label}: '${text}'에 '${word}'`);
        }
      }
    }
  }

  for (const status of RULE_STATUSES) {
    const view = getInlineStatusView(status);

    for (const line of view.lines) {
      for (const word of FORBIDDEN_WORDS) {
        assert.ok(!line.includes(word), `${JSON.stringify(status)}: '${line}'에 '${word}'`);
      }
    }
  }
});

const photoAt = (slotId: string) => ({ slotId });

test("빠지는 사진은 새 프레임에 없는 칸의 사진만 센다", () => {
  const fourSlotPhotos = ["slot-1", "slot-2", "slot-3", "slot-4"].map(photoAt);

  assert.equal(splitPhotosByFrame({ photos: fourSlotPhotos, nextSlotIds: ["slot-1", "slot-2"] }).dropped.length, 2);
  assert.equal(
    splitPhotosByFrame({ photos: ["slot-1", "slot-2"].map(photoAt), nextSlotIds: ["slot-1", "slot-2", "slot-3"] }).dropped.length,
    0,
  );
  assert.equal(splitPhotosByFrame({ photos: [], nextSlotIds: ["slot-1", "slot-2"] }).dropped.length, 0);
});

test("남는 사진은 새 프레임의 칸에 있는 사진이고 빠지는 사진과 겹치지 않는다", () => {
  const photos = ["slot-1", "slot-2", "slot-3"].map(photoAt);
  const { kept, dropped } = splitPhotosByFrame({ photos, nextSlotIds: ["slot-1", "slot-3"] });

  assert.deepEqual(kept, [photos[0], photos[2]]);
  assert.deepEqual(dropped, [photos[1]]);
});

// 확인창에는 대상 프레임만 저장하고, 안내 문구는 그릴 때마다 지금 사진 목록으로 다시 셉니다(UX1-2).
test("확인창을 연 뒤 사진이 늘어나면 같은 계산이 늘어난 장수를 돌려준다", () => {
  const twoSlotFrame = ["slot-1", "slot-2"];
  const photosWhenOpened = ["slot-1"].map(photoAt);
  const photosAfterLateImport = ["slot-1", "slot-3"].map(photoAt);

  assert.equal(splitPhotosByFrame({ photos: photosWhenOpened, nextSlotIds: twoSlotFrame }).dropped.length, 0);
  assert.equal(splitPhotosByFrame({ photos: photosAfterLateImport, nextSlotIds: twoSlotFrame }).dropped.length, 1);
});

test("사진을 기다리는 중 저장하지 못했어요 안내는 첫 줄만 더하고 나머지는 같다", () => {
  const waitingView = getNoticeView({ kind: "save-failed", hasPickedFile: true, isWaitingForPhotos: true });
  const baseView = getNoticeView({ kind: "save-failed", hasPickedFile: true, isWaitingForPhotos: false });

  assert.equal(waitingView.lines[0], "사진을 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요.");
  assert.deepEqual(waitingView.lines.slice(1), baseView.lines);
  assert.equal(waitingView.title, baseView.title);
  assert.equal(waitingView.tone, baseView.tone);
  assert.deepEqual(waitingView.actions, baseView.actions);
  assert.equal(waitingView.closeActionId, "close");
  assert.equal(waitingView.isBusy, false);
});

test("스티커 저장 실패 안내는 닫기 하나와 다시 누르기 줄을 보인다", () => {
  const view = getNoticeView({ kind: "save-failed", hasPickedFile: false, isWaitingForPhotos: false, saveTarget: "sticker" });
  assert.equal(view.title, "스티커를 저장하지 못했어요");
  assert.deepEqual(view.lines, ["[이 스티커만 저장]을 다시 눌러 주세요.", "계속 안 되면 직원을 불러 주세요."]);
  assert.equal(view.tone, "error");
  assert.deepEqual(view.actions, [{ id: "close", label: "닫기", isPrimary: true }]);
  assert.equal(view.closeActionId, "close");

  const pickedView = getNoticeView({ kind: "save-failed", hasPickedFile: true, isWaitingForPhotos: false, saveTarget: "sticker" });
  assert.deepEqual(pickedView.lines, [
    "고른 파일은 아직 비어 있어요.",
    "[이 스티커만 저장]을 다시 눌러 주세요.",
    "계속 안 되면 직원을 불러 주세요.",
  ]);
  for (const noticeView of [view, pickedView]) {
    for (const word of FORBIDDEN_WORDS) {
      assert.equal([noticeView.title, ...noticeView.lines].some((text) => text.includes(word)), false, word);
    }
  }
});

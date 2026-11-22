import test from "node:test";
import assert from "node:assert/strict";

import {
  BRUSH_SCREEN_RADIUS,
  BRUSH_SIZE_OPTIONS,
  getLocalBrushRadius,
  isBrushPointerStart,
  shouldEndPhotoEraseOnLayoutChange,
  shouldKeepPhotoEraseMode,
  toNormalizedStroke,
} from "../../src/photo/photoTool.ts";

test("로컬 좌표를 0..1 획으로 정규화한다", () => {
  const stroke = toNormalizedStroke([50, 25, 100, 50], 200, 100, 8);

  assert.deepEqual(stroke, { points: [0.25, 0.25, 0.5, 0.5], radius: 0.04 });
});

test("사진 밖의 점은 버리고 남은 점으로 획을 만든다", () => {
  const stroke = toNormalizedStroke([-10, 20, 50, 25], 200, 100, 8);

  assert.deepEqual(stroke, { points: [0.25, 0.25], radius: 0.04 });
});

test("남은 점이 없으면 null이다", () => {
  const stroke = toNormalizedStroke([-10, 20], 200, 100, 8);

  assert.equal(stroke, null);
});

test("화면 반지름을 절댓값 배율로 나눠 로컬 반지름을 구한다", () => {
  assert.equal(getLocalBrushRadius(16, 2), 8);
  assert.equal(getLocalBrushRadius(16, -2), 8);
});

test("붓 크기 상수와 선택지 문구가 정해진 값이다", () => {
  assert.deepEqual(BRUSH_SCREEN_RADIUS, { small: 8, medium: 16, large: 28 });
  assert.deepEqual(
    BRUSH_SIZE_OPTIONS.map((option) => option.label),
    ["작게", "보통", "크게"],
  );
});

test("마우스는 왼쪽 버튼만 획을 시작하고 펜·터치는 기본 입력을 받는다", () => {
  assert.equal(isBrushPointerStart("mouse", true, 0), true);
  assert.equal(isBrushPointerStart("mouse", true, 1), false);
  assert.equal(isBrushPointerStart("mouse", true, 2), false);
  assert.equal(isBrushPointerStart("pen", true, 0), true);
  assert.equal(isBrushPointerStart("touch", true, 0), true);
  assert.equal(isBrushPointerStart("touch", false, 0), false);
});

const ERASE_TEST_IMAGES = [{ id: "photo-1" }, { id: "photo-2" }];

test("소유 사진이 실제로 선택되어 있고 문서에 남으면 지우기 모드를 지킨다", () => {
  assert.equal(
    shouldKeepPhotoEraseMode({ eraseOwnerImageId: "photo-1", selectedImageId: "photo-1", userImages: ERASE_TEST_IMAGES }),
    true,
  );
});

test("소유 사진이 문서에서 사라지면 지우기 모드를 끈다", () => {
  assert.equal(
    shouldKeepPhotoEraseMode({ eraseOwnerImageId: "photo-1", selectedImageId: "photo-1", userImages: [{ id: "photo-2" }] }),
    false,
  );
  assert.equal(shouldKeepPhotoEraseMode({ eraseOwnerImageId: "photo-1", selectedImageId: "photo-1", userImages: [] }), false);
});

test("실제 선택 사진이 소유 사진과 다르거나 없으면 지우기 모드를 끈다", () => {
  assert.equal(
    shouldKeepPhotoEraseMode({ eraseOwnerImageId: "photo-1", selectedImageId: "photo-2", userImages: ERASE_TEST_IMAGES }),
    false,
  );
  assert.equal(
    shouldKeepPhotoEraseMode({ eraseOwnerImageId: "photo-1", selectedImageId: null, userImages: ERASE_TEST_IMAGES }),
    false,
  );
  assert.equal(
    shouldKeepPhotoEraseMode({ eraseOwnerImageId: null, selectedImageId: "photo-1", userImages: ERASE_TEST_IMAGES }),
    false,
  );
});

test("휴대폰·데스크톱 배치가 어느 쪽으로든 바뀌면 사진 지우기 모드를 끝낸다", () => {
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: false, isPhotoEraseMode: true }), true);
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: false, isMobileEditor: true, isPhotoEraseMode: true }), true);
});

test("배치가 그대로면 사진 지우기 모드를 지킨다", () => {
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: true, isPhotoEraseMode: true }), false);
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: false, isMobileEditor: false, isPhotoEraseMode: true }), false);
});

test("사진 지우기 모드가 아니면 배치가 바뀌어도 끝낼 것이 없다", () => {
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: false, isPhotoEraseMode: false }), false);
});

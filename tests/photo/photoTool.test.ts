import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BRUSH_SCREEN_RADIUS,
  BRUSH_SIZE_OPTIONS,
  getDefaultBrushSize,
  getLocalBrushRadius,
  getVisiblePhotoSpanWidth,
  isBrushPointerStart,
  LAYOUT_MEDIA_QUERIES,
  shouldEndPhotoEraseOnLayoutChange,
  shouldKeepCutoutPickMode,
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

// 390×844 세로 휴대폰과 844×390 가로 휴대폰의 배치 미디어 조건 값입니다(D-13).
const PORTRAIT_PHONE_MEDIA = { isMobilePortrait: true, isNarrow: true, isShortLandscape: false };
const LANDSCAPE_PHONE_MEDIA = { isMobilePortrait: false, isNarrow: false, isShortLandscape: true };
const DESKTOP_MEDIA = { isMobilePortrait: false, isNarrow: false, isShortLandscape: false };

test("휴대폰·데스크톱 배치가 어느 쪽으로든 바뀌면 사진 지우기 모드를 끝낸다", () => {
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: false, wasLayoutMedia: PORTRAIT_PHONE_MEDIA, layoutMedia: DESKTOP_MEDIA, isPhotoEraseMode: true }), true);
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: false, isMobileEditor: true, wasLayoutMedia: DESKTOP_MEDIA, layoutMedia: PORTRAIT_PHONE_MEDIA, isPhotoEraseMode: true }), true);
});

test("휴대폰 배치 그대로 제어판·캔버스 배치 미디어 조건이 바뀌면 사진 지우기 모드를 끝낸다", () => {
  // 세로↔가로 회전(ST2-1)
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: true, wasLayoutMedia: PORTRAIT_PHONE_MEDIA, layoutMedia: LANDSCAPE_PHONE_MEDIA, isPhotoEraseMode: true }), true);
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: true, wasLayoutMedia: LANDSCAPE_PHONE_MEDIA, layoutMedia: PORTRAIT_PHONE_MEDIA, isPhotoEraseMode: true }), true);
  // 굵은 포인터 태블릿에서 768px 경계만 넘을 때
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: true, wasLayoutMedia: DESKTOP_MEDIA, layoutMedia: { ...DESKTOP_MEDIA, isNarrow: true }, isPhotoEraseMode: true }), true);
});

test("배치와 배치 미디어 조건이 그대로면 사진 지우기 모드를 지킨다", () => {
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: true, wasLayoutMedia: PORTRAIT_PHONE_MEDIA, layoutMedia: { ...PORTRAIT_PHONE_MEDIA }, isPhotoEraseMode: true }), false);
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: false, isMobileEditor: false, wasLayoutMedia: DESKTOP_MEDIA, layoutMedia: { ...DESKTOP_MEDIA }, isPhotoEraseMode: true }), false);
});

test("사진 지우기 모드가 아니면 배치가 바뀌어도 끝낼 것이 없다", () => {
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: false, wasLayoutMedia: PORTRAIT_PHONE_MEDIA, layoutMedia: DESKTOP_MEDIA, isPhotoEraseMode: false }), false);
  assert.equal(shouldEndPhotoEraseOnLayoutChange({ wasMobileEditor: true, isMobileEditor: true, wasLayoutMedia: PORTRAIT_PHONE_MEDIA, layoutMedia: LANDSCAPE_PHONE_MEDIA, isPhotoEraseMode: false }), false);
});

test("배치 미디어 조건은 components.css의 제어판·캔버스 배치 미디어 조건과 같다", () => {
  const componentsCss = readFileSync(new URL("../../src/components/components.css", import.meta.url), "utf8");
  for (const query of Object.values(LAYOUT_MEDIA_QUERIES)) {
    assert.ok(componentsCss.includes(`@media ${query} {`), `components.css에 ${query}가 없습니다`);
  }
});

test("확대된 사진 화면 폭이 320px 이상이면 붓 기본 크기는 보통이다", () => {
  assert.equal(getDefaultBrushSize(320), "medium");
  assert.equal(getDefaultBrushSize(586), "medium");
});

test("확대된 사진 화면 폭이 320px보다 작거나 알 수 없으면 붓 기본 크기는 작게다", () => {
  for (const width of [319, 89, 0, Number.NaN, -5]) {
    assert.equal(getDefaultBrushSize(width), "small", `폭 ${width}`);
  }
});

test("사진 가로 구간과 칸이 겹치는 폭을 돌려준다", () => {
  assert.equal(getVisiblePhotoSpanWidth({ photoLeft: 150, photoWidth: 200, slotLeft: 100, slotWidth: 400 }), 200);
  assert.equal(getVisiblePhotoSpanWidth({ photoLeft: 50, photoWidth: 600, slotLeft: 100, slotWidth: 400 }), 400);
  assert.equal(getVisiblePhotoSpanWidth({ photoLeft: 400, photoWidth: 200, slotLeft: 100, slotWidth: 400 }), 100);
  assert.equal(getVisiblePhotoSpanWidth({ photoLeft: 600, photoWidth: 200, slotLeft: 100, slotWidth: 400 }), 0);
});

test("좌우 뒤집힌 사진도 겹치는 폭을 구하고, 값이 유한하지 않으면 NaN이다", () => {
  assert.equal(getVisiblePhotoSpanWidth({ photoLeft: 300, photoWidth: -200, slotLeft: 100, slotWidth: 400 }), 200);
  const span = { photoLeft: 150, photoWidth: 200, slotLeft: 100, slotWidth: 400 };
  for (const key of Object.keys(span) as (keyof typeof span)[]) {
    assert.ok(Number.isNaN(getVisiblePhotoSpanWidth({ ...span, [key]: Number.NaN })), `${key} NaN`);
  }
});

test("고르기 모드는 같은 프레임의 보이는 캔버스에서 주인 사진이 칸에 있고 선택이 주인과 맞을 때만 남는다", () => {
  const common = { frame: "4v_1", isCanvasVisible: true };
  const withPhoto = [{ id: "p1" }, { id: "p2" }];
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: null, selection: null, userImages: withPhoto }), false);

  const firstPick = { sourceImageId: "p1", stickerId: null, frame: "4v_1" };
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: firstPick, selection: null, userImages: withPhoto }), true);
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: firstPick, selection: "p2", userImages: withPhoto }), false);
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: firstPick, selection: null, userImages: [{ id: "p2" }] }), false);
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: firstPick, selection: null, userImages: [{ id: "p3" }] }), false);

  const replacePick = { sourceImageId: "p1", stickerId: "s1", frame: "4v_1" };
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: replacePick, selection: "s1", userImages: withPhoto }), true);
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: replacePick, selection: null, userImages: withPhoto }), false);
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: replacePick, selection: "s2", userImages: withPhoto }), false);
  assert.equal(shouldKeepCutoutPickMode({ ...common, owner: replacePick, selection: "s1", userImages: [{ id: "p2" }] }), false);

  assert.equal(
    shouldKeepCutoutPickMode({ owner: firstPick, selection: null, userImages: withPhoto, frame: "6v_1", isCanvasVisible: true }),
    false,
  );
  assert.equal(
    shouldKeepCutoutPickMode({ owner: firstPick, selection: null, userImages: withPhoto, frame: "4v_1", isCanvasVisible: false }),
    false,
  );
});

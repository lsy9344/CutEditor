import test from "node:test";
import assert from "node:assert/strict";

import {
  PHOTO_ADJUST_FIELDS,
  PHOTO_PRESETS,
  appendEraseStroke,
  applyPresetToEdits,
  copyAdjustToAll,
  createDefaultPhotoEdits,
  isDefaultPhotoEdits,
  isIdentityAdjust,
  stepAdjustField,
} from "../../src/photo/photoEdits.ts";
import {
  PHOTO_EDIT_FEATURES,
  getPhotoEditSections,
} from "../../src/photo/photoEditFeatures.ts";

const STROKE_1 = { points: [0.1, 0.2, 0.3, 0.4], radius: 0.05 };
const STROKE_2 = { points: [0.5, 0.6], radius: 0.1 };

test("createDefaultPhotoEdits는 기본값을 새 객체로 만든다", () => {
  const first = createDefaultPhotoEdits();
  const second = createDefaultPhotoEdits();

  assert.deepEqual(first, {
    adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    presetId: "original",
    erase: [],
  });
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.adjust, second.adjust);
  assert.notStrictEqual(first.erase, second.erase);
});

test("PHOTO_PRESETS는 정해진 순서와 이름을 가진다", () => {
  assert.deepEqual(
    PHOTO_PRESETS.map((preset) => preset.id),
    ["original", "bright", "warm", "calm", "mono"],
  );
  assert.deepEqual(
    PHOTO_PRESETS.map((preset) => preset.label),
    ["원본", "화사하게", "따뜻하게", "차분하게", "흑백"],
  );
});

test("PHOTO_PRESETS의 calm과 mono는 정해진 보정 값을 가진다", () => {
  const calm = PHOTO_PRESETS.find((preset) => preset.id === "calm");
  const mono = PHOTO_PRESETS.find((preset) => preset.id === "mono");

  assert.deepEqual(calm?.adjust, {
    brightness: 0,
    contrast: -10,
    saturation: -20,
    warmth: -15,
  });
  assert.deepEqual(mono?.adjust, {
    brightness: 0,
    contrast: 15,
    saturation: -100,
    warmth: 0,
  });
});

test("PHOTO_ADJUST_FIELDS는 쉬운 이름의 네 항목을 정해진 범위로 제공한다", () => {
  assert.deepEqual(
    PHOTO_ADJUST_FIELDS.map((field) => [field.key, field.label]),
    [
      ["brightness", "밝기"],
      ["contrast", "선명하게"],
      ["saturation", "색감"],
      ["warmth", "따뜻함"],
    ],
  );

  for (const field of PHOTO_ADJUST_FIELDS) {
    assert.equal(field.min, -100);
    assert.equal(field.max, 100);
    assert.equal(field.step, 10);
  }
});

test("applyPresetToEdits는 프리셋 값의 복사본을 적용하고 지우기 획은 유지한다", () => {
  const edits = createDefaultPhotoEdits();
  edits.erase = [STROKE_1];

  const applied = applyPresetToEdits(edits, "mono");
  const mono = PHOTO_PRESETS.find((preset) => preset.id === "mono");

  assert.deepEqual(applied.adjust, {
    brightness: 0,
    contrast: 15,
    saturation: -100,
    warmth: 0,
  });
  assert.equal(applied.presetId, "mono");
  assert.deepEqual(applied.erase, [STROKE_1]);
  assert.notStrictEqual(applied.adjust, mono?.adjust);
});

test("stepAdjustField는 한 칸 더하고 프리셋 강조를 지운다", () => {
  const bright = applyPresetToEdits(createDefaultPhotoEdits(), "bright");
  const stepped = stepAdjustField(bright, "brightness", 1);

  assert.equal(stepped.adjust.brightness, 20);
  assert.equal(stepped.presetId, null);
});

test("stepAdjustField는 -100과 100을 넘지 않는다", () => {
  const atMax = stepAdjustField(
    { adjust: { brightness: 100, contrast: 0, saturation: 0, warmth: 0 }, presetId: "bright", erase: [] },
    "brightness",
    1,
  );
  const atMin = stepAdjustField(
    { adjust: { brightness: -100, contrast: 0, saturation: 0, warmth: 0 }, presetId: "bright", erase: [] },
    "brightness",
    -1,
  );

  assert.equal(atMax.adjust.brightness, 100);
  assert.equal(atMin.adjust.brightness, -100);
});

test("copyAdjustToAll은 보정 값과 프리셋만 복사하고 지우기 획은 둔다", () => {
  const imageA = {
    id: "A",
    edits: {
      ...applyPresetToEdits(createDefaultPhotoEdits(), "bright"),
      erase: [STROKE_1],
    },
  };
  const imageB = {
    id: "B",
    edits: {
      ...createDefaultPhotoEdits(),
      erase: [STROKE_2],
    },
  };

  const copied = copyAdjustToAll([imageA, imageB], "A");
  const copiedB = copied.find((image) => image.id === "B");

  assert.deepEqual(copiedB?.edits.adjust, {
    brightness: 10,
    contrast: 10,
    saturation: 15,
    warmth: 0,
  });
  assert.equal(copiedB?.edits.presetId, "bright");
  assert.deepEqual(copiedB?.edits.erase, [STROKE_2]);
  assert.deepEqual(copied[0]?.edits, imageA.edits);
  assert.notStrictEqual(copiedB?.edits.adjust, copied[0]?.edits.adjust);
});

test("copyAdjustToAll은 원본 id가 없으면 입력 배열을 그대로 돌려준다", () => {
  const images = [
    { id: "A", edits: createDefaultPhotoEdits() },
    { id: "B", edits: createDefaultPhotoEdits() },
  ];

  assert.strictEqual(copyAdjustToAll(images, "missing"), images);
});

test("isIdentityAdjust는 모든 값이 0일 때만 참이다", () => {
  assert.equal(
    isIdentityAdjust({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 }),
    true,
  );
  assert.equal(
    isIdentityAdjust({ brightness: 0, contrast: 0, saturation: 0, warmth: 10 }),
    false,
  );
});

test("isDefaultPhotoEdits는 지우기 획이 있으면 거짓이고 presetId는 보지 않는다", () => {
  assert.equal(
    isDefaultPhotoEdits({
      adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
      presetId: null,
      erase: [STROKE_1],
    }),
    false,
  );
  assert.equal(
    isDefaultPhotoEdits({
      adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
      presetId: null,
      erase: [],
    }),
    true,
  );
});

test("PHOTO_EDIT_FEATURES는 세 기능을 모두 켠다", () => {
  assert.deepEqual(PHOTO_EDIT_FEATURES, { adjust: true, erase: true, cutout: true });
});

test("getPhotoEditSections는 기능 스위치에 따라 보일 줄을 정한다", () => {
  assert.deepEqual(getPhotoEditSections({ adjust: true, erase: true, cutout: true }), {
    showBox: true,
    showAdjust: true,
    showErase: true,
  });
  assert.deepEqual(getPhotoEditSections({ adjust: true, erase: false, cutout: true }), {
    showBox: true,
    showAdjust: true,
    showErase: false,
  });
  assert.deepEqual(getPhotoEditSections({ adjust: false, erase: true, cutout: true }), {
    showBox: true,
    showAdjust: false,
    showErase: true,
  });
  assert.deepEqual(getPhotoEditSections({ adjust: false, erase: false, cutout: true }), {
    showBox: false,
    showAdjust: false,
    showErase: false,
  });
});

test("획 덧붙이기는 지금 문서의 그 사진 획 끝에 붙인다", () => {
  const imageA = { id: "a", edits: createDefaultPhotoEdits() };
  const imageB = { id: "b", edits: { ...createDefaultPhotoEdits(), erase: [STROKE_1] } };
  const images = [imageA, imageB];

  const afterFirst = appendEraseStroke(images, "a", STROKE_1);
  const afterSecond = appendEraseStroke(afterFirst, "a", STROKE_2);

  assert.deepEqual(afterSecond[0].edits.erase, [STROKE_1, STROKE_2]);
  assert.equal(afterSecond[1], imageB);
  assert.deepEqual(images[0].edits.erase, []);
});

test("획 덧붙이기는 없는 사진이면 그대로 돌려준다", () => {
  const images = [{ id: "a", edits: createDefaultPhotoEdits() }];

  assert.equal(appendEraseStroke(images, "missing", STROKE_1), images);
});

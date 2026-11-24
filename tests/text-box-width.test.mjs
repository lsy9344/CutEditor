import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("세로쓰기 최소 폭은 글자 실제 폭 기준으로 계산한다", async () => {
  const { getMinimumTextBoxWidthForMeasuredWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.equal(
    getMinimumTextBoxWidthForMeasuredWidth({
      measuredWidth: 19.2,
      isVertical: true,
    }),
    20,
  );
});

test("가로쓰기 최소 폭은 기존 기본 폭 160을 유지한다", async () => {
  const { getMinimumTextBoxWidthForMeasuredWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.equal(
    getMinimumTextBoxWidthForMeasuredWidth({
      measuredWidth: 80,
      isVertical: false,
    }),
    160,
  );
});

test("가로쓰기에서 세로쓰기로 바꾸면 기존 큰 폭 대신 세로쓰기 최소 폭으로 줄어든다", async () => {
  const { resolveTextBoxWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.equal(
    resolveTextBoxWidth({
      previousBoxWidth: 160,
      minimumBoxWidth: 20,
      didOrientationChange: true,
    }),
    20,
  );
});

test("방향 전환이 없으면 기존처럼 최소 폭보다 큰 사용 폭을 유지한다", async () => {
  const { resolveTextBoxWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.equal(
    resolveTextBoxWidth({
      previousBoxWidth: 220,
      minimumBoxWidth: 160,
      didOrientationChange: false,
    }),
    220,
  );
});

test("폰트를 받기 전에 넣은 글자는 받은 뒤 실제 폰트 너비로 다시 잰다", async () => {
  const { resolveFontAwareTextBoxWidth, applyLoadedFontBoxWidths } = await loadTsModule("src/canvas/textBoxWidth.ts");

  const inserted = resolveFontAwareTextBoxWidth({
    previousBoxWidth: 0,
    hasExplicitBoxWidth: false,
    minimumBoxWidth: 300,
    didOrientationChange: false,
    isFontReady: false,
  });
  assert.deepEqual(inserted, { boxWidth: 300, boxWidthBeforeFontLoad: 0 });

  const texts = [
    { id: "a", fontFamily: "Aritaburi", boxWidth: 300, boxWidthBeforeFontLoad: 0 },
    { id: "b", fontFamily: "DungGeunMo", boxWidth: 250 },
  ];
  const remeasured = applyLoadedFontBoxWidths(texts, {
    isFontReady: () => true,
    getMinimumBoxWidth: () => 220,
  });

  assert.deepEqual(remeasured, [
    { id: "a", fontFamily: "Aritaburi", boxWidth: 220 },
    { id: "b", fontFamily: "DungGeunMo", boxWidth: 250 },
  ]);
  assert.equal(remeasured[1], texts[1]);
});

test("폰트를 받기 전에 여러 번 고쳐도 받은 뒤에는 대체 폰트 너비 대신 원래 사용 폭을 기준으로 한다", async () => {
  const { resolveFontAwareTextBoxWidth, applyLoadedFontBoxWidths } = await loadTsModule("src/canvas/textBoxWidth.ts");

  // 받아 둔 폰트에서 사용자가 280으로 늘린 글자를, 아직 받지 않은 폰트로 바꾼다.
  const afterFontChange = resolveFontAwareTextBoxWidth({
    previousBoxWidth: 280,
    hasExplicitBoxWidth: false,
    minimumBoxWidth: 350,
    didOrientationChange: false,
    isFontReady: false,
  });
  assert.deepEqual(afterFontChange, { boxWidth: 350, boxWidthBeforeFontLoad: 280 });

  // 받기 전에 글자 내용을 늘린다.
  const afterTextEdit = resolveFontAwareTextBoxWidth({
    previousBoxWidth: 350,
    boxWidthBeforeFontLoad: 280,
    hasExplicitBoxWidth: false,
    minimumBoxWidth: 400,
    didOrientationChange: false,
    isFontReady: false,
  });
  assert.deepEqual(afterTextEdit, { boxWidth: 400, boxWidthBeforeFontLoad: 280 });

  const [remeasured] = applyLoadedFontBoxWidths(
    [{ fontFamily: "DungGeunMo", boxWidth: 400, boxWidthBeforeFontLoad: 280 }],
    { isFontReady: () => true, getMinimumBoxWidth: () => 260 },
  );
  assert.equal(remeasured.boxWidth, 280);
});

test("폰트를 받기 전에 사용자가 직접 바꾼 폭은 받은 뒤에도 기준으로 남는다", async () => {
  const { resolveFontAwareTextBoxWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.deepEqual(
    resolveFontAwareTextBoxWidth({
      previousBoxWidth: 500,
      boxWidthBeforeFontLoad: 0,
      hasExplicitBoxWidth: true,
      minimumBoxWidth: 300,
      didOrientationChange: false,
      isFontReady: false,
    }),
    { boxWidth: 500, boxWidthBeforeFontLoad: 500 },
  );
});

test("받아 둔 폰트로 다시 재면 대체 폰트 기록을 지우고 원래 사용 폭을 기준으로 한다", async () => {
  const { resolveFontAwareTextBoxWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.deepEqual(
    resolveFontAwareTextBoxWidth({
      previousBoxWidth: 400,
      boxWidthBeforeFontLoad: 0,
      hasExplicitBoxWidth: false,
      minimumBoxWidth: 200,
      didOrientationChange: false,
      isFontReady: true,
    }),
    { boxWidth: 200 },
  );
});

test("아직 받지 않은 폰트는 다시 재지 않는다", async () => {
  const { applyLoadedFontBoxWidths } = await loadTsModule("src/canvas/textBoxWidth.ts");
  const texts = [{ fontFamily: "Aritaburi", boxWidth: 300, boxWidthBeforeFontLoad: 0 }];

  const result = applyLoadedFontBoxWidths(texts, {
    isFontReady: () => false,
    getMinimumBoxWidth: () => 100,
  });

  assert.equal(result, texts);
});

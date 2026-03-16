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

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("스티커 편집 리셋 helper는 반전 또는 틴트 변경 여부를 정확히 판단한다", async () => {
  const { hasStickerEditChanges, getStickerEditResetUpdates } = await loadTsModule("src/canvas/stickerEdit.ts");

  assert.equal(
    hasStickerEditChanges({ flipX: false, flipY: false, tintColor: null }),
    false,
  );
  assert.equal(
    hasStickerEditChanges({ flipX: true, flipY: false, tintColor: null }),
    true,
  );
  assert.equal(
    hasStickerEditChanges({ flipX: false, flipY: false, tintColor: "#ff0000" }),
    true,
  );
  assert.deepEqual(getStickerEditResetUpdates(), {
    flipX: false,
    flipY: false,
    tintColor: null,
  });
});

test("CanvasStage는 스티커 편집 리셋 helper를 사용해 버튼 상태와 초기화를 연결한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(
    source,
    /import \{\s*getStickerEditResetUpdates,\s*hasStickerEditChanges,\s*\} from "\.\/stickerEdit";/s,
  );
  assert.match(
    source,
    /const canResetStickerEdit = selectedSticker \? hasStickerEditChanges\(selectedSticker\) : false;/,
  );
  assert.match(
    source,
    /onClick=\{\(\) => onStickerUpdate\?\.\(selectedSticker\.id, getStickerEditResetUpdates\(\)\)\}/,
  );
  assert.match(source, /disabled=\{!canResetStickerEdit\}/);
});

test("텍스트 박스 폭 helper는 세로쓰기일 때 실제 측정 폭을 그대로 사용한다", async () => {
  const { getMinimumTextBoxWidthForMeasuredWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.equal(
    getMinimumTextBoxWidthForMeasuredWidth({ measuredWidth: 28, isVertical: true }),
    28,
  );
  assert.equal(
    getMinimumTextBoxWidthForMeasuredWidth({ measuredWidth: 28, isVertical: false }),
    160,
  );
  assert.equal(
    getMinimumTextBoxWidthForMeasuredWidth({ measuredWidth: 180, isVertical: false }),
    228,
  );
});

test("텍스트 방향이 바뀌면 기존 박스 폭 대신 새 최소 폭으로 다시 맞춘다", async () => {
  const { resolveTextBoxWidth } = await loadTsModule("src/canvas/textBoxWidth.ts");

  assert.equal(
    resolveTextBoxWidth({
      previousBoxWidth: 220,
      minimumBoxWidth: 32,
      didOrientationChange: true,
    }),
    32,
  );
  assert.equal(
    resolveTextBoxWidth({
      previousBoxWidth: 220,
      minimumBoxWidth: 32,
      didOrientationChange: false,
    }),
    220,
  );
});

test("App은 텍스트 박스 폭 helper를 사용해 세로쓰기 전환 폭을 다시 계산한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /import \{\s*getMinimumTextBoxWidthForMeasuredWidth,\s*resolveTextBoxWidth,\s*\} from '\.\/canvas\/textBoxWidth'/s,
  );
  assert.match(
    source,
    /return getMinimumTextBoxWidthForMeasuredWidth\(\{\s*measuredWidth,\s*isVertical: textItem\.isVertical,\s*\}\);/s,
  );
  assert.match(
    source,
    /const didOrientationChange =\s*updates\.isVertical !== undefined &&\s*updates\.isVertical !== text\.isVertical &&\s*updates\.boxWidth === undefined;/s,
  );
  assert.match(
    source,
    /updatedText\.boxWidth = resolveTextBoxWidth\(\{\s*previousBoxWidth: updatedText\.boxWidth,\s*minimumBoxWidth,\s*didOrientationChange,\s*\}\);/s,
  );
});

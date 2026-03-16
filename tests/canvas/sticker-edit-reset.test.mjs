import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CanvasStage는 스티커 편집 변경이 있으면 리셋 버튼을 활성화한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(
    source,
    /const canResetStickerEdit = Boolean\(selectedSticker && \(selectedSticker\.flipX \|\| selectedSticker\.flipY \|\| selectedSticker\.tintColor\)\);/,
  );
  assert.match(source, /disabled=\{!canResetStickerEdit\}/);
});

test("CanvasStage는 스티커 편집 리셋 시 반전과 틴트를 기본값으로 되돌린다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(
    source,
    /onClick=\{\(\) => onStickerUpdate\?\.\(selectedSticker\.id,\s*\{\s*flipX: false,\s*flipY: false,\s*tintColor: null,\s*\}\)\}/s,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CanvasStage는 세로쓰기 텍스트 선택 상자 폭을 실제 렌더 폭에 맞춘다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(
    source,
    /const renderedTextWidth = textItem\.isVertical \? dimensions\.width : textItem\.boxWidth;/,
  );
  assert.match(source, /width=\{renderedTextWidth\}/);
  assert.match(source, /offsetX=\{renderedTextWidth \/ 2\}/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("옛 '가장자리 지우기' 문구가 소스에 남아 있지 않다", () => {
  const sourcePaths = ["src/photo/cutoutCopy.ts", "src/canvas/CanvasStage.tsx", "src/ui/EditorPanel.tsx", "src/App.tsx"];
  const removedTexts = ["가장자리 지우기", "지울 가장자리를 칠하세요"];

  for (const sourcePath of sourcePaths) {
    const source = readFileSync(sourcePath, "utf8");
    for (const removedText of removedTexts) {
      assert.ok(!source.includes(removedText), `${sourcePath}에 옛 문구가 남아 있습니다: ${removedText}`);
    }
  }
});

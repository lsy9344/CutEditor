import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("키보드 접근을 막던 옛 코드가 남아 있지 않다", () => {
  const canvasStageSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");
  const removedCanvasStageTexts = ["getRotatedTransform", "anchorSize={12}", "누르고 있으면 원본"];
  for (const removedText of removedCanvasStageTexts) {
    assert.ok(!canvasStageSource.includes(removedText), `src/canvas/CanvasStage.tsx에 옛 코드가 남아 있습니다: ${removedText}`);
  }

  const cardSourcePaths = ["src/canvas/FrameGallery.tsx", "src/ui/SidebarLeft.tsx"];
  for (const cardSourcePath of cardSourcePaths) {
    const cardSource = readFileSync(cardSourcePath, "utf8");
    assert.ok(!cardSource.includes("alt={option.label}"), `${cardSourcePath}의 카드 사진 설명이 이름과 겹칩니다: alt={option.label}`);
  }
});

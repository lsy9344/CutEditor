import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CanvasStage에 옛 편집 패널 문구와 11~12px 글자가 남아 있지 않다", () => {
  const sourcePath = "src/canvas/CanvasStage.tsx";
  const source = readFileSync(sourcePath, "utf8");
  const removedTexts = [
    "줌:</label>",
    "선택된 이미지 줌(%)",
    "이미지를 선택하거나 추가하세요",
    "선택된 이미지를 삭제합니다",
    "선택된 이미지 삭제",
    "aria-label={`색상 ${color}`}",
    "프레임 색상</label>",
    'aria-haspopup="dialog"',
    "좌우 반전",
    "상하 반전",
    "색상 변경",
    "틴트 색상 선택",
    "스티커 편집 상태를 기본값으로 복원",
    "CUTOUT_COPY.outlineOn",
  ];
  const removedPatterns = [/>\s*리셋\s*</, /fontSize: ['"]1[12]px['"]|fontSize: 1[12]\b/];

  for (const removedText of removedTexts) {
    assert.ok(!source.includes(removedText), `${sourcePath}에 옛 문구가 남아 있습니다: ${removedText}`);
  }
  for (const removedPattern of removedPatterns) {
    assert.ok(!removedPattern.test(source), `${sourcePath}에 옛 패턴이 남아 있습니다: ${removedPattern}`);
  }
});

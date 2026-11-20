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

test("EditorPanel에 alert, confirm과 옛 글씨 패널 문구가 남아 있지 않다", () => {
  const sourcePath = "src/ui/EditorPanel.tsx";
  const source = readFileSync(sourcePath, "utf8");
  const removedTexts = [
    "alert(",
    "confirm(",
    "사진에 글씨 새기기",
    "텍스트를 입력하세요.",
    "레터링을 추천해 드릴게요",
    "클릭해서 추천받기",
    "폰트 선택</p>",
    "'폰트 로딩 중'",
    "폰트 크기</p>",
    "폰트 색상</p>",
    "폰트 스타일</p>",
    "텍스트 정렬</p>",
    "클릭하여 스티커 목록을 확인하세요",
    "← 뒤로",
    "<h3>폰트 선택</h3>",
    "파일명(확장자 제외)",
    'aria-label="폰트 목록"',
    "사용할 수 있는 폰트가 없습니다",
    "선택한 스티커 삭제",
    "`${slot.key} sticker`",
  ];
  const removedPatterns = [/>\s*삭제\s*</, />\s*삽입\s*</];

  for (const removedText of removedTexts) {
    assert.ok(!source.includes(removedText), `${sourcePath}에 옛 문구가 남아 있습니다: ${removedText}`);
  }
  for (const removedPattern of removedPatterns) {
    assert.ok(!removedPattern.test(source), `${sourcePath}에 옛 패턴이 남아 있습니다: ${removedPattern}`);
  }
});

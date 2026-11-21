import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App에는 공유 화면의 옛 문구와 옛 대체 파일 이름이 없다", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  const removedTexts = [
    "내보내기 완료",
    "이 브라우저에서는 자동 저장이 불안정할 수 있어요",
    "아래 미리보기를 길게 눌러 이미지를",
    "공유 시트로 저장하거나",
    "내보낸 이미지 미리보기",
    "'컷 내보내기'",
    "'cut_export.png'",
  ];

  for (const removedText of removedTexts) {
    assert.ok(!source.includes(removedText), `App.tsx에 옛 문구가 남아 있습니다: ${removedText}`);
  }
  // 버튼 글자 자리(>…<)만 봅니다. 그 버튼의 주석 '이미지 열기(폴백)'은 남깁니다.
  assert.doesNotMatch(source, />\s*이미지 열기\s*</);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 폰트 목록이 오기 전에 글씨를 넣으면 패널의 폰트 이름이 그대로 글씨에 들어간다.
// 그 이름이 비어 있으면 캔버스 font 문자열("normal normal 16px ")이 무효가 되어
// 글씨 크기를 바꿔도 글자가 직전 폰트 크기로 그려진다(손잡이로 키워도 상자만 커짐).
test("글씨 패널의 폰트 초깃값은 폰트 목록(fonts.json)에 있는 기본 폰트다", () => {
  const source = readFileSync("src/ui/EditorPanel.tsx", "utf8");
  assert.match(source, /const \[fontFamily, setFontFamily\] = useState\(DEFAULT_FONT_FAMILY\);/);

  const defaultFontMatch = source.match(/const DEFAULT_FONT_FAMILY = "([^"]+)";/);
  assert.ok(defaultFontMatch, "기본 폰트 이름이 비어 있거나 없습니다");

  // useFonts는 fonts.json의 파일 이름에서 .ttf를 뺀 것을 폰트 이름으로 쓴다.
  const fontFiles = JSON.parse(readFileSync("public/font/fonts.json", "utf8"));
  assert.ok(
    fontFiles.includes(`${defaultFontMatch[1]}.ttf`),
    `기본 폰트 ${defaultFontMatch[1]}이 fonts.json 목록에 없습니다`,
  );
});

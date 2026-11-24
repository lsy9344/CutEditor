import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

// 폰트 목록이 오기 전에 글씨를 넣으면 패널의 폰트 이름이 그대로 글씨에 들어간다.
// 그 이름이 비어 있으면 캔버스 font 문자열("normal normal 16px ")이 무효가 되어
// 글씨 크기를 바꿔도 글자가 직전 폰트 크기로 그려진다(손잡이로 키워도 상자만 커짐).
test("글씨 패널의 폰트 초깃값은 폰트 목록(fonts.json)에 있는 기본 글꼴이다", async () => {
  const source = readFileSync("src/ui/EditorPanel.tsx", "utf8");
  // 기본 글꼴 이름은 fontLoader의 DEFAULT_FONT 한 곳에만 둔다.
  assert.match(source, /import \{[^}]*\bDEFAULT_FONT\b[^}]*\} from ["']\.\.\/utils\/fontLoader["']/);
  assert.doesNotMatch(source, /["']Aritaburi["']/);
  assert.match(source, /const \[fontFamily, setFontFamily\] = useState\(DEFAULT_FONT_FAMILY\);/);

  const { DEFAULT_FONT } = await loadTsModule("src/utils/fontLoader.ts");

  // useFonts는 fonts.json의 파일 이름에서 .ttf를 뺀 것을 폰트 이름으로, /font/<파일 이름>을 경로로 쓴다.
  const fontFiles = JSON.parse(readFileSync("public/font/fonts.json", "utf8"));
  const defaultFontFile = `${DEFAULT_FONT.name}.ttf`;
  assert.ok(fontFiles.includes(defaultFontFile), `기본 글꼴 ${DEFAULT_FONT.name}이 fonts.json 목록에 없습니다`);
  assert.equal(DEFAULT_FONT.path, `/font/${defaultFontFile}`);
  // 이 파일이 없으면 기본 글꼴 글씨는 저장할 수 없다(실패 안내).
  assert.ok(existsSync(`public${DEFAULT_FONT.path}`), `public${DEFAULT_FONT.path} 파일이 없습니다`);
});

// 목록 전에 넣은 글씨를 저장할 때도 저장 대기가 기본 글꼴 파일을 기다리게 한다.
test("앱을 시작할 때 기본 글꼴을 폰트 목록과 별개로 등록한다", () => {
  const source = readFileSync("src/main.tsx", "utf8");
  assert.match(source, /import \{[^}]*\bDEFAULT_FONT\b[^}]*\} from ["']\.\/utils\/fontLoader["']/);
  assert.match(source, /fontLoader\.register\(\[DEFAULT_FONT\]\)/);
});

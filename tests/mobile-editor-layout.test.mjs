import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("모바일 편집 모드에서는 캔버스 우선 레이아웃 클래스를 사용한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /app-main--mobile-editor/);
  assert.match(source, /app-mobile-toolbar/);
  assert.match(source, /app-mobile-sheet/);
});

test("모바일 편집 모드에서는 프레임/글씨/스티커/저장 액션 바를 렌더링한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /모바일 액션 바/);
  assert.match(source, /프레임/);
  assert.match(source, /글씨/);
  assert.match(source, /스티커/);
  assert.match(source, /저장/);
});

test("모바일 전용 시트 스타일이 components.css에 정의된다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  assert.match(source, /\.app-main--mobile-editor/);
  assert.match(source, /\.app-mobile-toolbar/);
  assert.match(source, /\.app-mobile-sheet/);
});

test("모바일 편집기 레이아웃은 화면 너비와 무관하게 app-main--mobile-editor 클래스만으로 강제된다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  const firstMobileEditorRule = source.indexOf(".app-main--mobile-editor {");
  const firstMobileWidthMedia = source.indexOf("@media (max-width: 768px)");

  assert.notEqual(firstMobileEditorRule, -1);
  assert.notEqual(firstMobileWidthMedia, -1);
  assert.ok(firstMobileEditorRule < firstMobileWidthMedia);
  assert.match(
    source,
    /\.app-main--mobile-editor\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*overflow:\s*hidden;/
  );
});

test("캔버스 Stage는 화면용 크기를 zoom에 맞춰 확장한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /const stageWidth = Math\.ceil\(frameLayout\.canvasWidth \* zoom\);/);
  assert.match(source, /const stageHeight = Math\.ceil\(frameLayout\.canvasHeight \* zoom\);/);
  assert.match(source, /width=\{stageWidth\}/);
  assert.match(source, /height=\{stageHeight\}/);
  assert.match(source, /scaleX=\{zoom\}/);
  assert.match(source, /scaleY=\{zoom\}/);
});

test("모바일 시트 본문은 내부 스크롤이 가능해야 한다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  assert.match(
    source,
    /\.app-mobile-sheet__content\s*\{[\s\S]*overflow-y:\s*auto;/
  );
});

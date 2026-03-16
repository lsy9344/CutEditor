import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("가로모드 미디어 쿼리가 components.css에 정의된다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  assert.match(source, /orientation:\s*landscape/);
  assert.match(source, /max-height:\s*500px/);
});

test("가로모드에서 모바일 에디터는 flex-direction: row로 전환한다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  // orientation: landscape 블록 내에 flex-direction: row 존재
  const landscapeBlock = source.match(
    /@media\s*\(orientation:\s*landscape\)[^{]*\{([\s\S]*?)(?:\n\})/
  );
  assert.ok(landscapeBlock, "landscape 미디어 쿼리 블록이 존재해야 합니다");
  assert.match(landscapeBlock[1], /flex-direction:\s*row/);
});

test("가로모드에서 캔버스 Shell의 min-height가 0으로 리셋된다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  // landscape 블록 내에 min-height: 0 존재
  const landscapeSection = source.slice(
    source.indexOf("orientation: landscape")
  );
  assert.match(landscapeSection, /\.app-mobile-canvas-shell[\s\S]*?min-height:\s*0/);
});

test("가로모드에서 툴바가 세로 1열로 변환된다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  const landscapeSection = source.slice(
    source.indexOf("orientation: landscape")
  );
  assert.match(landscapeSection, /\.app-mobile-toolbar[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(landscapeSection, /\.app-mobile-toolbar[\s\S]*?width:\s*72px/);
});

test("가로모드에서 바텀시트가 중앙 배치로 전환된다", () => {
  const source = readFileSync("src/components/components.css", "utf8");

  const landscapeSection = source.slice(
    source.indexOf("orientation: landscape")
  );
  assert.match(landscapeSection, /\.app-mobile-sheet-backdrop[\s\S]*?align-items:\s*center/);
});

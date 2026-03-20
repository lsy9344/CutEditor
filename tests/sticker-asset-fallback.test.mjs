import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("SVG 스티커 자산 후보 helper는 PNG 등 래스터 대체 자산을 만든다", () => {
  const source = readFileSync("src/utils/stickerSizing.ts", "utf8");

  assert.match(source, /const STICKER_RASTER_EXTENSIONS = \["png", "webp", "jpg", "jpeg"\] as const;/);
  assert.match(source, /export function getStickerAssetCandidates\(src: string\): string\[] \{/);
  assert.match(source, /if \(!lowerSrc\.endsWith\("\.svg"\)\) \{\s*return \[normalizedSrc\];\s*\}/);
  assert.match(source, /normalizedSrc\.replace\(\/\\\.svg\$\/i, `\.\$\{extension\}`\)/);
});

test("캔버스 스티커 로더는 자산 후보를 순차적으로 재시도한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /getStickerAssetCandidates\(sticker\.src\)/);
  assert.match(source, /candidateIndex \+= 1;/);
  assert.match(source, /tryLoadStickerImage\(\);/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("스티커 자산 후보 helper는 키별로 PNG 우선 또는 SVG 우선을 나눈다", async () => {
  const {
    STICKER_ASSET_AUDIT,
    STICKER_RASTER_FIRST_KEYS,
    getStickerAssetPreference,
    getStickerAssetCandidates,
    prefersRasterStickerAsset,
  } = await loadTsModule("src/utils/stickerAssetCandidates.ts");

  assert.deepEqual(STICKER_ASSET_AUDIT["1s_6ss"], {
    pngHasTransparency: true,
    svgContainsEmbeddedRaster: true,
    svgUsesMask: true,
  });
  assert.deepEqual(STICKER_ASSET_AUDIT["2s_6ss"], {
    pngHasTransparency: false,
    svgContainsEmbeddedRaster: false,
    svgUsesMask: false,
  });
  assert.equal(STICKER_RASTER_FIRST_KEYS.includes("1s_6ss"), true);
  assert.equal(STICKER_RASTER_FIRST_KEYS.includes("2s_5ss"), false);
  assert.equal(getStickerAssetPreference("1s_6ss"), "png-first");
  assert.equal(getStickerAssetPreference("2s_5ss"), "svg-first");
  assert.equal(getStickerAssetPreference("2s_6ss"), "svg-first");
  assert.equal(prefersRasterStickerAsset("1s_6ss"), true);
  assert.equal(prefersRasterStickerAsset("2s_6ss"), false);
  assert.equal(prefersRasterStickerAsset("2s_5ss"), false);
  assert.deepEqual(getStickerAssetCandidates("/stickers/1s_6ss.svg").slice(0, 2), [
    "/stickers/1s_6ss.png",
    "/stickers/1s_6ss.svg",
  ]);
  assert.deepEqual(getStickerAssetCandidates("/stickers/2s_6ss.png").slice(0, 2), [
    "/stickers/2s_6ss.svg",
    "/stickers/2s_6ss.png",
  ]);
  assert.deepEqual(getStickerAssetCandidates("/stickers/2s_5ss.png").slice(0, 2), [
    "/stickers/2s_5ss.svg",
    "/stickers/2s_5ss.png",
  ]);
});

test("캔버스 스티커 로더는 자산 후보를 순차적으로 재시도한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /getStickerAssetCandidates\(sticker\.src\)/);
  assert.match(source, /candidateIndex \+= 1;/);
  assert.match(source, /tryLoadStickerImage\(\);/);
});

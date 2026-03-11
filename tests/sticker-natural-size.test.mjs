import test from "node:test";
import assert from "node:assert/strict";

const loadModule = async () =>
  import(`../src/utils/stickerSizing.ts?ts=${Date.now()}`);

test("스티커 원본 크기를 그대로 반환한다", async () => {
  const { loadStickerDimensions } = await loadModule();

  const result = await loadStickerDimensions("/stickers/1s_7ss.svg", {
    fallbackWidth: 100,
    fallbackHeight: 100,
    imageLoader: async () => ({ width: 378, height: 567 }),
  });

  assert.deepEqual(result, { width: 378, height: 567 });
});

test("이미지 크기를 읽지 못하면 기본 크기로 되돌아간다", async () => {
  const { loadStickerDimensions } = await loadModule();

  const result = await loadStickerDimensions("/stickers/missing.svg", {
    fallbackWidth: 100,
    fallbackHeight: 100,
    imageLoader: async () => {
      throw new Error("load failed");
    },
  });

  assert.deepEqual(result, { width: 100, height: 100 });
});

test("원본 크기를 사용하더라도 캔버스 중앙에 배치할 수 있다", async () => {
  const { getCenteredStickerPosition } = await loadModule();

  const result = getCenteredStickerPosition({
    canvasWidth: 483,
    canvasHeight: 719,
    stickerWidth: 378,
    stickerHeight: 567,
  });

  assert.deepEqual(result, { x: 52.5, y: 76 });
});

test("100mm 원본 스티커는 약 18mm 표시 크기로 시작한다", async () => {
  const { getInitialStickerScale } = await loadModule();

  const result = getInitialStickerScale({
    width: 378,
    height: 378,
  });

  assert.ok(Math.abs(result - 0.18) < 0.005);
});

test("축소된 표시 크기를 기준으로 캔버스 중앙에 배치할 수 있다", async () => {
  const { getCenteredStickerPosition, getScaledStickerDimensions } = await loadModule();

  const scale = 18 / 150;
  const display = getScaledStickerDimensions({
    width: 378,
    height: 567,
    scale,
  });

  const result = getCenteredStickerPosition({
    canvasWidth: 483,
    canvasHeight: 719,
    stickerWidth: display.width,
    stickerHeight: display.height,
  });

  assert.ok(Math.abs(result.x - 218.82) < 0.1);
  assert.ok(Math.abs(result.y - 325.48) < 0.1);
});

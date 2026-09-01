import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const TINT = "#FF3366";

function makeImageData(pixels) {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  });
  return { data };
}

function readPixel(imageData, index = 0) {
  return Array.from(imageData.data.slice(index * 4, index * 4 + 4));
}

test("레터링 스티커(2s) 소스는 recolor 모드를 쓴다", async () => {
  const { getStickerTintMode } = await loadTsModule("src/canvas/stickerTint.ts");

  assert.equal(getStickerTintMode("/stickers/2s_10ss.svg"), "recolor");
  assert.equal(getStickerTintMode("/stickers/2s_4ss.png"), "recolor");
});

test("기본/흑백 일러스트 스티커와 외부 소스는 multiply 모드를 유지한다", async () => {
  const { getStickerTintMode } = await loadTsModule("src/canvas/stickerTint.ts");

  assert.equal(getStickerTintMode("/stickers/1s_3ss.svg"), "multiply");
  assert.equal(getStickerTintMode("/stickers/3s_12ss.png"), "multiply");
  assert.equal(getStickerTintMode(""), "multiply");
});

test("multiply는 검은 글자 픽셀을 바꾸지 않는다(기존 불만 재현 방지용 회귀)", async () => {
  const { createStickerTintFilter } = await loadTsModule("src/canvas/stickerTint.ts");
  const filter = createStickerTintFilter(TINT, "multiply");
  const imageData = makeImageData([[0, 0, 0, 255]]);

  filter(imageData);

  assert.deepEqual(readPixel(imageData), [0, 0, 0, 255]);
});

test("multiply는 흰 픽셀을 정확히 선택 색상으로 만든다", async () => {
  const { createStickerTintFilter } = await loadTsModule("src/canvas/stickerTint.ts");
  const filter = createStickerTintFilter(TINT, "multiply");
  const imageData = makeImageData([[255, 255, 255, 255]]);

  filter(imageData);

  assert.deepEqual(readPixel(imageData), [255, 51, 102, 255]);
});

test("recolor는 검은 글자도 선택 색상으로 바꾼다", async () => {
  const { createStickerTintFilter } = await loadTsModule("src/canvas/stickerTint.ts");
  const filter = createStickerTintFilter(TINT, "recolor");
  const imageData = makeImageData([[0, 0, 0, 255]]);

  filter(imageData);

  assert.deepEqual(readPixel(imageData), [255, 51, 102, 255]);
});

test("recolor는 알파를 유지해 투명 배경과 부드러운 가장자리를 보존한다", async () => {
  const { createStickerTintFilter } = await loadTsModule("src/canvas/stickerTint.ts");
  const filter = createStickerTintFilter(TINT, "recolor");
  const imageData = makeImageData([
    [10, 20, 30, 0],
    [10, 20, 30, 128],
    [10, 20, 30, 255],
  ]);

  filter(imageData);

  assert.deepEqual(readPixel(imageData, 0), [255, 51, 102, 0]);
  assert.deepEqual(readPixel(imageData, 1), [255, 51, 102, 128]);
  assert.deepEqual(readPixel(imageData, 2), [255, 51, 102, 255]);
});

test("recolor는 노란 글자도 선택 색상으로 통일한다(다중 색 입력)", async () => {
  const { createStickerTintFilter } = await loadTsModule("src/canvas/stickerTint.ts");
  const filter = createStickerTintFilter(TINT, "recolor");
  const imageData = makeImageData([
    [251, 178, 21, 255],
    [77, 80, 140, 255],
    [255, 255, 255, 255],
  ]);

  filter(imageData);

  assert.deepEqual(readPixel(imageData, 0), [255, 51, 102, 255]);
  assert.deepEqual(readPixel(imageData, 1), [255, 51, 102, 255]);
  assert.deepEqual(readPixel(imageData, 2), [255, 51, 102, 255]);
});

test("잘못된 색상 값이면 어떤 픽셀도 바꾸지 않는다", async () => {
  const { createStickerTintFilter } = await loadTsModule("src/canvas/stickerTint.ts");
  const filter = createStickerTintFilter("not-a-color", "recolor");
  const imageData = makeImageData([[0, 0, 0, 255]]);

  filter(imageData);

  assert.deepEqual(readPixel(imageData), [0, 0, 0, 255]);
});

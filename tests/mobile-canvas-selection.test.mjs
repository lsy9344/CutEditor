import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("이미지 업로드 직후 App은 새 이미지를 바로 선택한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /selection:\s*imageId/);
  assert.match(source, /selectedSlot:\s*slotId/);
});

test("모바일 스티커 조작은 터치 시작마다 재선택하지 않는다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /onTap=\{\(\) => selectSticker\(sticker\.id\)\}/);
  assert.doesNotMatch(source, /onTouchStart=\{\(\) => selectSticker\(sticker\.id\)\}/);
});

test("모바일 텍스트 조작은 터치 시작마다 재선택하지 않는다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /onTap=\{\(\) => selectText\(textItem\.id\)\}/);
  assert.doesNotMatch(source, /onTouchStart=\{\(\) => selectText\(textItem\.id\)\}/);
});

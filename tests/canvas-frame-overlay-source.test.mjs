import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("CanvasStage는 popover 이미지를 프레임 오버레이 후보에 포함하지 않는다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.doesNotMatch(source, /`\/popover\/\$\{frameType\}\.png`/);
  assert.match(source, /primaryPath,/);
  assert.match(source, /`\/frame\/\$\{frameType\}\.png`/);
});

test("4컷 세로 1 프레임 오버레이 파일은 CanvasStage가 기대하는 이름으로 존재한다", () => {
  assert.equal(existsSync("public/frame/4_v_1.png"), true);
});

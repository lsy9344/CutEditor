import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("4컷 세로 계열 기본 텍스트 위치는 2컷 세로와 같다", async () => {
  const { getDefaultTextPosition } = await loadTsModule("src/ui/defaultTextPosition.ts");

  const twoVertical = getDefaultTextPosition("2v");
  const frameTypes = ["4v", "4", "4v_1", "4v_2", "4v_3", "4v_4", "4v_5", "4v_6"];

  assert.deepEqual(twoVertical, { x: 241.5, y: 630 });

  frameTypes.forEach((frameType) => {
    assert.deepEqual(getDefaultTextPosition(frameType), twoVertical);
  });
});

test("기존 다른 프레임 기본 위치는 유지된다", async () => {
  const { getDefaultTextPosition } = await loadTsModule("src/ui/defaultTextPosition.ts");

  assert.deepEqual(getDefaultTextPosition("2h"), { x: 620, y: 241.5 });
  assert.deepEqual(getDefaultTextPosition("1l"), { x: 241.5, y: 100 });
});

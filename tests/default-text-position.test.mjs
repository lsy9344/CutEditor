import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("세로 변형 컷들의 기본 텍스트 위치는 각 기준 위치와 같다", async () => {
  const { getDefaultTextPosition } = await loadTsModule("src/ui/defaultTextPosition.ts");

  const twoVertical = getDefaultTextPosition("2v_1");
  const frameTypes = [
    "4v_1",
    "4v_2",
    "4v_3",
    "4v_4",
    "4v_5",
    "4v_6",
    "3v_1",
    "2v_1",
    "8v_1",
    "8v_2",
    "8v_3",
  ];

  const sixVertical = getDefaultTextPosition("6v_1");
  const sixVariantTypes = ["6v_1", "6v_2"];

  const nineVertical = getDefaultTextPosition("9v_1");

  assert.deepEqual(twoVertical, { x: 241.5, y: 630 });

  frameTypes.forEach((frameType) => {
    assert.deepEqual(getDefaultTextPosition(frameType), twoVertical);
  });

  assert.deepEqual(sixVertical, { x: 241.5, y: 660 });
  sixVariantTypes.forEach((frameType) => {
    assert.deepEqual(getDefaultTextPosition(frameType), sixVertical);
  });

  assert.deepEqual(nineVertical, { x: 241.5, y: 650 });
});

test("기존 다른 프레임 기본 위치는 유지된다", async () => {
  const { getDefaultTextPosition } = await loadTsModule("src/ui/defaultTextPosition.ts");

  assert.deepEqual(getDefaultTextPosition("2h"), { x: 620, y: 241.5 });
  assert.deepEqual(getDefaultTextPosition("1l"), { x: 241.5, y: 100 });
});

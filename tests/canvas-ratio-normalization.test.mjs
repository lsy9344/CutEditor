import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const loadFrameModule = async () =>
  loadTsModule("src/types/frame.ts");

test("모든 프레임 캔버스가 정확한 2:3 또는 3:2 비율을 사용한다", async () => {
  const { FRAME_LAYOUTS } = await loadFrameModule();

  for (const layout of Object.values(FRAME_LAYOUTS)) {
    const isVertical = layout.canvasHeight > layout.canvasWidth;
    const isExactRatio = isVertical
      ? layout.canvasWidth * 3 === layout.canvasHeight * 2
      : layout.canvasWidth * 2 === layout.canvasHeight * 3;

    assert.equal(
      isExactRatio,
      true,
      `${layout.id} expected exact ratio but received ${layout.canvasWidth}x${layout.canvasHeight}`,
    );
  }
});

test("4컷 세로 1 레이아웃은 새 캔버스 안에서 좌우 균형을 유지한다", async () => {
  const { FRAME_LAYOUTS } = await loadFrameModule();
  const layout = FRAME_LAYOUTS["4v_1"];
  const firstColumn = layout.slots.filter((slot) => slot.x < layout.canvasWidth / 2);
  const secondColumn = layout.slots.filter((slot) => slot.x >= layout.canvasWidth / 2);

  const leftMargin = Math.min(...firstColumn.map((slot) => slot.x));
  const rightMargin = Math.min(
    ...secondColumn.map((slot) => layout.canvasWidth - (slot.x + slot.width)),
  );

  assert.ok(
    Math.abs(leftMargin - rightMargin) <= 1,
    `expected balanced margins but received left=${leftMargin}, right=${rightMargin}`,
  );
});

test("앱 기본 캔버스와 갤러리 카드도 정확한 2:3 기준을 사용한다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const cssSource = readFileSync("src/components/components.css", "utf8");

  assert.match(appSource, /const DEFAULT_CANVAS_WIDTH = EXACT_VERTICAL_CANVAS\.width;/);
  assert.match(appSource, /const DEFAULT_CANVAS_HEIGHT = EXACT_VERTICAL_CANVAS\.height;/);
  assert.match(cssSource, /aspect-ratio:\s*2\/3;/);
  assert.match(cssSource, /aspect-ratio:\s*3\/2;/);
});

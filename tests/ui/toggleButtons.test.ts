import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const canvasSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");
const labelsSource = readFileSync("src/state/editorLabels.ts", "utf8");

// 켠 토글의 ✓는 보이게만 두고 접근 이름에서는 뺍니다. 이름과 aria-pressed는 aside(A7-08)로 잡고, 여기는 지운 코드가 없는지만 봅니다.
test("접근 이름에 ✓를 넣던 getToggleButtonLabel은 없어졌다", () => {
  assert.ok(!canvasSource.includes("getToggleButtonLabel"), "CanvasStage가 아직 부릅니다");
  assert.ok(!labelsSource.includes("getToggleButtonLabel"), "editorLabels에 남아 있습니다");
  assert.ok(!canvasSource.includes("`✓ ${"), "버튼 글자에 ✓를 붙이는 코드가 남아 있습니다");
});

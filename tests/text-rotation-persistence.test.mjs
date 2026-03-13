import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("텍스트 회전 핸들은 회전값을 상태에 저장하고 다시 렌더링한다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");
  const stageSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(appSource, /rotation:\s*number;/);
  assert.match(appSource, /rotation:\s*0/);
  assert.match(appSource, /updates:\s*Partial<\{[\s\S]*rotation:\s*number;/);

  assert.match(stageSource, /textAlign:\s*"left" \| "center" \| "right";[\s\S]*rotation:\s*number;/);
  assert.match(stageSource, /rotation=\{textItem\.rotation\}/);
  assert.match(stageSource, /onTextUpdate\?\.\(textItem\.id,\s*\{[\s\S]*rotation:\s*node\.rotation\(\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App과 CanvasStage에는 디버그 console.log가 없다", () => {
  for (const path of ["src/App.tsx", "src/canvas/CanvasStage.tsx"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /console\.log\(/, path);
  }
});

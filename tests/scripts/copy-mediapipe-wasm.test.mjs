import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

const WASM_DIR = "node_modules/@mediapipe/tasks-vision/wasm";
const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

test("copy-mediapipe-wasm copies the four runtime files", () => {
  const targetDir = mkdtempSync(join(os.tmpdir(), "mp-"));

  try {
    execFileSync(process.execPath, ["scripts/copy-mediapipe-wasm.mjs", targetDir]);

    for (const name of WASM_FILES) {
      const copiedPath = join(targetDir, name);
      const originalPath = join(WASM_DIR, name);
      assert.ok(existsSync(copiedPath), name);
      assert.equal(statSync(copiedPath).size, statSync(originalPath).size, name);
    }
  } finally {
    rmSync(targetDir, { recursive: true, force: true });
  }
});

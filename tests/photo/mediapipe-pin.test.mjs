import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_DIR = "node_modules/@mediapipe/tasks-vision";
const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

test("package.json pins @mediapipe/tasks-vision to 0.10.35", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.dependencies["@mediapipe/tasks-vision"], "0.10.35");
});

test("installed @mediapipe/tasks-vision version is 0.10.35", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8"));
  assert.equal(pkg.version, "0.10.35");
});

test("vision bundle does not reference odml.pa.googleapis.com", () => {
  const source = readFileSync(join(PACKAGE_DIR, "vision_bundle.mjs"), "utf8");
  assert.equal(source.includes("odml.pa.googleapis.com"), false);
});

test("wasm directory contains the four runtime files", () => {
  for (const name of WASM_FILES) {
    assert.ok(existsSync(join(PACKAGE_DIR, "wasm", name)), name);
  }
});

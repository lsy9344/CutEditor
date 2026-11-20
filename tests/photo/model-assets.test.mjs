import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MODELS = [
  {
    name: "selfie_segmenter.tflite",
    size: 249537,
    sha256: "191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b",
  },
  {
    name: "magic_touch.tflite",
    size: 6227884,
    sha256: "e24338a717c1b7ad8d159666677ef400babb7f33b8ad60c4d96db4ecf694cd25",
  },
];

test("model files match the recorded size and SHA-256", () => {
  for (const model of MODELS) {
    const path = join("public/models", model.name);
    assert.equal(statSync(path).size, model.size, model.name);

    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    assert.equal(hash, model.sha256, model.name);
  }
});

test("models README records the Apache-2.0 license", () => {
  const readme = readFileSync("public/models/README.md", "utf8");
  assert.match(readme, /Apache-2\.0/);
});

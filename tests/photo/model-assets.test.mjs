import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MODELS = [
  {
    name: "selfie_multiclass_256x256.c6748b1253a99067.tflite",
    size: 16371837,
    sha256: "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0",
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
  },
  {
    name: "magic_touch.e24338a717c1b7ad.tflite",
    size: 6227884,
    sha256: "e24338a717c1b7ad8d159666677ef400babb7f33b8ad60c4d96db4ecf694cd25",
    url: "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite",
  },
];

const readModelPaths = () => {
  const source = readFileSync("src/photo/segmentation.ts", "utf8");
  const everyone = source.match(/const EVERYONE_MODEL_PATH = "([^"]+)";/);
  const point = source.match(/const POINT_MODEL_PATH = "([^"]+)";/);
  assert.ok(everyone, "EVERYONE_MODEL_PATH");
  assert.ok(point, "POINT_MODEL_PATH");
  return [everyone[1], point[1]];
};

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
  for (const model of MODELS) {
    assert.ok(readme.includes(model.url), model.url);
  }
});

test("model file names carry the first 16 hex of their SHA-256", () => {
  for (const model of MODELS) {
    const match = model.name.match(/\.([0-9a-f]{16})\.tflite$/);
    assert.ok(match, model.name);
    assert.equal(match[1], model.sha256.slice(0, 16), model.name);
  }
  const files = readdirSync("public/models").filter((name) => name.endsWith(".tflite")).sort();
  assert.deepEqual(files, MODELS.map((model) => model.name).sort());
});

test("segmentation model paths point to the hashed files", () => {
  const [everyonePath, pointPath] = readModelPaths();
  assert.equal(everyonePath, `/models/${MODELS[0].name}`);
  assert.equal(pointPath, `/models/${MODELS[1].name}`);
  for (const path of [everyonePath, pointPath]) {
    assert.ok(existsSync(`public${path}`), path);
  }
});

test("vercel.json sets immutable only on the two hashed model URLs", () => {
  const text = readFileSync("vercel.json", "utf8");
  const config = JSON.parse(text);
  assert.deepEqual(Object.keys(config), ["headers"]);
  assert.equal(config.headers.length, 2);
  assert.deepEqual(
    config.headers.map((rule) => rule.source),
    readModelPaths(),
  );
  for (const rule of config.headers) {
    assert.deepEqual(rule.headers, [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]);
    assert.doesNotMatch(rule.source, /[()[\]*+?:\\]/, rule.source);
  }
  assert.ok(!text.includes("Cross-Origin"));
});

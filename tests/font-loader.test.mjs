import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const createFakeBrowserFonts = () => {
  const created = [];
  const added = [];
  const loadCalls = [];

  const createFace = (family, url) => {
    let resolveLoad;
    const face = {
      family,
      url,
      status: "unloaded",
      load() {
        loadCalls.push(family);
        face.status = "loading";
        return new Promise((resolve) => {
          resolveLoad = () => {
            face.status = "loaded";
            resolve(face);
          };
        });
      },
      finishLoad() {
        resolveLoad();
      },
    };
    created.push(face);
    return face;
  };

  return {
    created,
    added,
    loadCalls,
    createFace,
    addFace: (face) => added.push(face),
    removeFace: () => {},
  };
};

test("폰트 목록을 등록해도 폰트 파일은 받지 않는다", async () => {
  const { createFontLoader } = await loadTsModule("src/utils/fontLoader.ts");
  const browserFonts = createFakeBrowserFonts();
  const fontLoader = createFontLoader(browserFonts);

  fontLoader.register([
    { name: "Aritaburi", path: "/font/Aritaburi.ttf" },
    { name: "온글잎 박다현체", path: "/font/온글잎 박다현체.ttf" },
  ]);

  assert.deepEqual(browserFonts.loadCalls, []);
  assert.deepEqual(
    browserFonts.added.map((face) => [face.family, face.url]),
    [
      ["Aritaburi", "/font/Aritaburi.ttf"],
      ["온글잎 박다현체", "/font/온글잎 박다현체.ttf"],
    ],
  );
  assert.equal(fontLoader.isReady("Aritaburi"), false);
});

test("같은 폰트를 여러 번 요청해도 한 번만 받고, 받은 뒤 준비 상태가 된다", async () => {
  const { createFontLoader } = await loadTsModule("src/utils/fontLoader.ts");
  const browserFonts = createFakeBrowserFonts();
  const fontLoader = createFontLoader(browserFonts);
  fontLoader.register([
    { name: "Aritaburi", path: "/font/Aritaburi.ttf" },
    { name: "DungGeunMo", path: "/font/DungGeunMo.ttf" },
  ]);

  const first = fontLoader.ensureLoaded(["Aritaburi"]);
  const second = fontLoader.ensureLoaded(["Aritaburi", "Aritaburi"]);

  assert.deepEqual(browserFonts.loadCalls, ["Aritaburi"]);
  assert.equal(fontLoader.isReady("Aritaburi"), false);

  browserFonts.created[0].finishLoad();
  await Promise.all([first, second]);

  assert.equal(fontLoader.isReady("Aritaburi"), true);
  assert.equal(fontLoader.isReady("DungGeunMo"), false);
});

test("목록에 없는 폰트는 받지 않고 바로 준비된 것으로 본다", async () => {
  const { createFontLoader } = await loadTsModule("src/utils/fontLoader.ts");
  const browserFonts = createFakeBrowserFonts();
  const fontLoader = createFontLoader(browserFonts);

  await fontLoader.ensureLoaded(["sans-serif"]);

  assert.deepEqual(browserFonts.loadCalls, []);
  assert.equal(fontLoader.isReady("sans-serif"), true);
});

test("폰트 받기에 실패해도 기다림이 끝나고 대체 폰트로 진행한다", async () => {
  const { createFontLoader } = await loadTsModule("src/utils/fontLoader.ts");
  const fontLoader = createFontLoader({
    createFace: () => {
      const face = {
        status: "unloaded",
        load: () => {
          face.status = "error";
          return Promise.reject(new Error("network"));
        },
      };
      return face;
    },
    addFace: () => {},
    removeFace: () => {},
  });
  fontLoader.register([{ name: "Aritaburi", path: "/font/Aritaburi.ttf" }]);

  await assert.doesNotReject(fontLoader.ensureLoaded(["Aritaburi"]));

  assert.equal(fontLoader.isReady("Aritaburi"), true);
});

test("받기에 실패한 폰트는 다음 요청 때 새로 받는다", async () => {
  const { createFontLoader } = await loadTsModule("src/utils/fontLoader.ts");
  const attempts = [];
  const removed = [];
  let shouldFail = true;
  const fontLoader = createFontLoader({
    createFace: (family, url) => {
      const face = {
        status: "unloaded",
        load: () => {
          attempts.push([family, url]);
          face.status = shouldFail ? "error" : "loaded";
          return shouldFail
            ? Promise.reject(new Error("network"))
            : Promise.resolve(face);
        },
      };
      return face;
    },
    addFace: () => {},
    removeFace: (face) => removed.push(face.status),
  });
  fontLoader.register([{ name: "Aritaburi", path: "/font/Aritaburi.ttf" }]);

  await fontLoader.ensureLoaded(["Aritaburi"]);
  shouldFail = false;
  await fontLoader.ensureLoaded(["Aritaburi"]);

  assert.deepEqual(attempts, [
    ["Aritaburi", "/font/Aritaburi.ttf"],
    ["Aritaburi", "/font/Aritaburi.ttf"],
  ]);
  assert.deepEqual(removed, ["error"]);
  assert.equal(fontLoader.isReady("Aritaburi"), true);
});

test("편집 화면의 폰트 목록은 이름만 등록하고 폰트 파일을 직접 받지 않는다", () => {
  const source = readFileSync("src/hooks/useFonts.ts", "utf8");

  assert.match(source, /fontLoader\.register\(fontInfos\)/);
  assert.doesNotMatch(source, /\.load\(\)/);
});

test("저장은 글자에 쓰인 폰트를 받은 뒤에 화면 오버레이를 지우고 그린다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /await loadTextFonts\(texts\.map\(text => text\.fontFamily\)\);\s*setExportMode\(true\);/,
  );
});

test("화면이 먼저 받다가 실패한 폰트도 요청하면 새로 받는다", async () => {
  const { createFontLoader } = await loadTsModule("src/utils/fontLoader.ts");
  const created = [];
  const fontLoader = createFontLoader({
    createFace: () => {
      const face = {
        status: "unloaded",
        load: () => {
          face.status = "loaded";
          return Promise.resolve(face);
        },
      };
      created.push(face);
      return face;
    },
    addFace: () => {},
    removeFace: () => {},
  });
  fontLoader.register([{ name: "Aritaburi", path: "/font/Aritaburi.ttf" }]);
  created[0].status = "error";

  await fontLoader.ensureLoaded(["Aritaburi"]);

  assert.equal(created.length, 2);
  assert.equal(created[1].status, "loaded");
});

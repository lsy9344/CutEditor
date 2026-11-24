import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readHandleExportSource } from "./helpers/readHandleExportSource.mjs";
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

test("폰트 받기에 실패하면 기다림은 끝나지만 준비된 것으로 보지 않고 실패한 이름을 알려 준다", async () => {
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

  const failedFontFamilies = await fontLoader.ensureLoaded(["Aritaburi"]);

  assert.deepEqual(failedFontFamilies, ["Aritaburi"]);
  assert.equal(fontLoader.isReady("Aritaburi"), false);
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

test("저장은 글자에 쓰인 폰트를 한 번 더 받아 보고, 30초를 넘기거나 그래도 못 받으면 대체 폰트로 그리지 않고 멈춘다", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  const exportSource = readHandleExportSource();

  assert.match(source, /const SAVE_FONT_WAIT_LIMIT_MS = 30_000;/);
  // 다시 받기까지 모두 합쳐 상한을 두고, 넘으면 쓰인 폰트를 모두 받지 못한 것으로 본다.
  assert.match(
    source,
    /const loadTextFontsForSave = useCallback\(\(fontFamilies: string\[\]\) => resolveWithinTimeout\(\s*loadTextFonts\(fontFamilies\)\.then\(\(failedFontFamilies\) => \(\s*failedFontFamilies\.length > 0 \? loadTextFonts\(failedFontFamilies\) : failedFontFamilies\s*\)\),\s*SAVE_FONT_WAIT_LIMIT_MS,\s*fontFamilies,\s*\), \[loadTextFonts\]\);/,
  );
  assert.match(exportSource, /const failedFontFamilies = await loadTextFontsForSave\(textFontFamilies\);/);
  const stopIndex = exportSource.indexOf("if (failedFontFamilies.length > 0) {", exportSource.indexOf("await loadTextFontsForSave(textFontFamilies)"));
  const renderIndex = exportSource.indexOf("setExportMode(true);");
  assert.ok(stopIndex > 0 && stopIndex < renderIndex, "폰트 실패 확인은 렌더 전에 있어야 합니다");
  // 못 받으면 prepareCanvas가 던져 렌더·쓰기 없이 멈춘다(runSaveFlow의 failed, tests/state/saveFlow.test.ts).
  const stopBlock = exportSource.slice(stopIndex, renderIndex);
  assert.match(stopBlock, /isFontLoadFailed = true;\s*throw new Error\(/);
  // 멈춘 저장은 고른 경로·이름·핸들을 남기고 글씨체 안내를 띄운다.
  assert.match(
    exportSource,
    /if \(result\.kind === 'failed' && isFontLoadFailed\) \{[\s\S]*?retrySaveRef\.current = result\.retry;[\s\S]*?setInlineStatus\(\{ kind: 'save-blocked', message: FONT_LOAD_FAILED_MESSAGE \}\);\s*return;\s*\}/,
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

test("폰트 받기에 실패하는 동안 기준 폭을 남기고, 다시 받기가 성공하면 실제 폰트 폭으로 돌아온다", async () => {
  const { createFontLoader } = await loadTsModule("src/utils/fontLoader.ts");
  const { applyLoadedFontBoxWidths } = await loadTsModule("src/canvas/textBoxWidth.ts");
  let shouldFail = true;
  const fontLoader = createFontLoader({
    createFace: () => {
      const face = {
        status: "unloaded",
        load: () => {
          face.status = shouldFail ? "error" : "loaded";
          return shouldFail ? Promise.reject(new Error("network")) : Promise.resolve(face);
        },
      };
      return face;
    },
    addFace: () => {},
    removeFace: () => {},
  });
  fontLoader.register([{ name: "Aritaburi", path: "/font/Aritaburi.ttf" }]);
  // 대체 폰트로 잰 312px가 들어가 있고, 받기 전 기준 폭은 0(최소 폭만 사용)이다.
  const textsWithFallbackWidth = [{ fontFamily: "Aritaburi", boxWidth: 312, boxWidthBeforeFontLoad: 0 }];
  const measureWithCurrentFont = () => (fontLoader.isReady("Aritaburi") ? 305 : 312);
  const applyWidths = (texts) => applyLoadedFontBoxWidths(texts, {
    isFontReady: fontLoader.isReady,
    getMinimumBoxWidth: measureWithCurrentFont,
  });

  assert.deepEqual(await fontLoader.ensureLoaded(["Aritaburi"]), ["Aritaburi"]);
  const textsAfterFailure = applyWidths(textsWithFallbackWidth);
  assert.equal(textsAfterFailure[0].boxWidthBeforeFontLoad, 0);

  shouldFail = false;
  assert.deepEqual(await fontLoader.ensureLoaded(["Aritaburi"]), []);
  const textsAfterRetry = applyWidths(textsAfterFailure);
  assert.equal(textsAfterRetry[0].boxWidth, 305);
  assert.equal("boxWidthBeforeFontLoad" in textsAfterRetry[0], false);
});

test("받기에 실패한 폰트는 실패로 표시해, 화면이 글자를 고칠 때마다 다시 받지 않게 한다", async () => {
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
  fontLoader.register([
    { name: "Aritaburi", path: "/font/Aritaburi.ttf" },
    { name: "DungGeunMo", path: "/font/DungGeunMo.ttf" },
  ]);

  assert.equal(fontLoader.hasFailed("Aritaburi"), false);
  await fontLoader.ensureLoaded(["Aritaburi"]);

  assert.equal(fontLoader.hasFailed("Aritaburi"), true);
  assert.equal(fontLoader.hasFailed("DungGeunMo"), false);
  assert.equal(fontLoader.hasFailed("sans-serif"), false);
});

test("화면의 폰트 받기는 실패한 폰트를 건너뛴다(다시 받기는 저장할 때만)", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /\.filter\(fontFamily => !fontLoader\.isReady\(fontFamily\) && !fontLoader\.hasFailed\(fontFamily\)\);/,
  );
});

test("기다림이 상한 안에 끝나면 그 결과를, 넘으면 정해 둔 값을 돌려준다", async () => {
  const { resolveWithinTimeout } = await loadTsModule("src/utils/fontLoader.ts");

  assert.deepEqual(await resolveWithinTimeout(Promise.resolve([]), 50, ["Aritaburi"]), []);

  const neverSettles = new Promise(() => {});
  const startedAt = Date.now();
  assert.deepEqual(await resolveWithinTimeout(neverSettles, 30, ["Aritaburi"]), ["Aritaburi"]);
  assert.ok(Date.now() - startedAt >= 25, "상한 전에 끝나면 안 됩니다");
});

test("기다림이 실패하면 상한을 기다리지 않고 그 실패를 그대로 넘긴다", async () => {
  const { resolveWithinTimeout } = await loadTsModule("src/utils/fontLoader.ts");

  await assert.rejects(
    resolveWithinTimeout(Promise.reject(new Error("boom")), 10_000, []),
    /boom/,
  );
});

test("목록을 받기 전에 등록한 기본 글꼴은 저장 대기가 파일을 받을 때까지 기다리고, 목록이 와도 다시 만들지 않는다", async () => {
  const { createFontLoader, DEFAULT_FONT } = await loadTsModule("src/utils/fontLoader.ts");
  const browserFonts = createFakeBrowserFonts();
  const fontLoader = createFontLoader(browserFonts);

  assert.deepEqual(DEFAULT_FONT, { name: "Aritaburi", path: "/font/Aritaburi.ttf" });
  fontLoader.register([DEFAULT_FONT]);

  // 등록만 하고 받지는 않는다(편집 화면 진입 때 .ttf 0건).
  assert.deepEqual(browserFonts.loadCalls, []);
  assert.equal(fontLoader.isReady("Aritaburi"), false);

  let waitFinished = false;
  const waitForSave = fontLoader.ensureLoaded(["Aritaburi"]).then((failedFontFamilies) => {
    waitFinished = true;
    return failedFontFamilies;
  });
  await Promise.resolve();
  assert.deepEqual(browserFonts.loadCalls, ["Aritaburi"]);
  assert.equal(waitFinished, false);

  fontLoader.register([
    { name: "Aritaburi", path: "/font/Aritaburi.ttf" },
    { name: "DungGeunMo", path: "/font/DungGeunMo.ttf" },
  ]);
  assert.deepEqual(
    browserFonts.added.map((face) => face.family),
    ["Aritaburi", "DungGeunMo"],
  );

  browserFonts.created[0].finishLoad();
  assert.deepEqual(await waitForSave, []);
  assert.equal(fontLoader.isReady("Aritaburi"), true);
});

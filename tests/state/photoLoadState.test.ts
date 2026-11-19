import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getPhotoImagesState,
  isCurrentPhotoLoad,
} from "../../src/state/photoLoadState.ts";

const makeImage = (id: string, url: string) => ({ id, url });
const loaded = (url: string) => ({ url, image: {} });

test("문서 사진이 모두 현재 URL로 로드되면 ready다", () => {
  const state = getPhotoImagesState(
    [makeImage("img-1", "blob:a"), makeImage("img-2", "blob:b")],
    new Map([
      ["img-1", loaded("blob:a")],
      ["img-2", loaded("blob:b")],
    ]),
  );

  assert.deepEqual(state, { kind: "ready" });
});

test("현재 URL의 로드 결과가 없으면 loading이다", () => {
  const state = getPhotoImagesState(
    [makeImage("img-1", "blob:a")],
    new Map(),
  );

  assert.deepEqual(state, { kind: "loading" });
});

test("같은 id라도 URL이 바뀌면 이전 캐시를 ready로 치지 않는다", () => {
  const state = getPhotoImagesState(
    [makeImage("img-1", "blob:new")],
    new Map([["img-1", loaded("blob:old")]]),
  );

  assert.deepEqual(state, { kind: "loading" });
});

test("현재 URL의 로드가 실패하면 failed와 imageIds를 알린다", () => {
  const state = getPhotoImagesState(
    [makeImage("img-1", "blob:a"), makeImage("img-2", "blob:b")],
    new Map<string, { url: string; image: object | null }>([
      ["img-1", { url: "blob:a", image: null }],
      ["img-2", loaded("blob:b")],
    ]),
  );

  assert.deepEqual(state, { kind: "failed", imageIds: ["img-1"] });
});

test("실패가 하나라도 있으면 다른 사진의 로딩보다 실패를 먼저 알린다", () => {
  const state = getPhotoImagesState(
    [makeImage("img-1", "blob:a"), makeImage("img-2", "blob:b")],
    new Map([["img-1", { url: "blob:a", image: null }]]),
  );

  assert.deepEqual(state, { kind: "failed", imageIds: ["img-1"] });
});

test("isCurrentPhotoLoad는 현재 문서의 같은 id·URL 요청만 유효하다고 본다", () => {
  const currentUrls = new Map([["img-1", "blob:new"]]);

  assert.equal(isCurrentPhotoLoad("img-1", "blob:new", currentUrls), true);
  assert.equal(isCurrentPhotoLoad("img-1", "blob:old", currentUrls), false);
  assert.equal(isCurrentPhotoLoad("img-2", "blob:new", currentUrls), false);
});

test("App은 저장을 시작하기 전에 CanvasStage의 사진 로딩 경계를 기다린다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /const photoImagesState = await waitForPhotoImages\(\);/);
  assert.match(source, /if \(photoImagesState\.kind === "failed"\) \{/);
  assert.match(source, /alert\('사진을 불러오지 못했어요\. 다시 저장해 주세요\.'\);/);
  assert.match(source, /onPhotoImagesStateChange=\{handlePhotoImagesStateChange\}/);
  assert.ok(
    source.indexOf("const photoImagesState = await waitForPhotoImages();")
      < source.indexOf("const blob = await exportBlobFromStage({ frameType, stage });"),
  );
  assert.ok(
    source.indexOf("const photoImagesState = await waitForPhotoImages();")
      < source.indexOf("const savedToBoothySession = await saveToBoothySession({"),
  );
  assert.ok(
    source.indexOf("const photoImagesState = await waitForPhotoImages();")
      < source.indexOf("if (exportExperience === 'share-sheet') {"),
  );
});

test("CanvasStage는 현재 문서 URL 기준으로 사진 로딩 상태를 알리고 늦은 콜백을 버린다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /const photoImagesState = getPhotoImagesState\(userImages, loadedImages\);/);
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*onPhotoImagesStateChange\(photoImagesState\);\s*\}, \[onPhotoImagesStateChange, photoImagesStateKey, userImages\]\);/,
  );
  assert.match(source, /if \(!isCurrentPhotoLoad\(userImage\.id, userImage\.url, userImageUrlsRef\.current\)\) return;/);
  assert.match(source, /pendingLoad\.image\.onload = null;/);
  assert.match(source, /pendingLoad\.image\.onerror = null;/);
  assert.match(source, /if \(loadedImages\.get\(userImage\.id\)\?\.url === userImage\.url\) return;/);
  assert.match(source, /if \(activeImageUrls\.get\(imageId\) !== loadedEntry\.url\) \{/);
});

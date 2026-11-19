import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getPhotoImagesState,
  getPhotoSaveBlockMessage,
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

test("loading 상태는 저장을 막고 로딩 안내 문구를 돌려준다", () => {
  assert.equal(
    getPhotoSaveBlockMessage({ kind: "loading" }),
    "사진을 불러오는 중이에요. 잠시 후 저장해 주세요.",
  );
});

test("failed 상태는 저장을 막고 사진을 다시 넣으라는 안내를 돌려준다", () => {
  assert.equal(
    getPhotoSaveBlockMessage({ kind: "failed", imageIds: ["img-1"] }),
    "사진 한 장을 불러오지 못했어요. 그 사진을 지우고 다시 넣어 주세요.",
  );
});

test("ready 상태는 저장을 막지 않는다", () => {
  assert.equal(getPhotoSaveBlockMessage({ kind: "ready" }), null);
});

test("App은 저장을 기다리지 않고 프레임 확인 직후 사진 준비 상태를 동기로 막는다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.doesNotMatch(source, /waitForPhotoImages|photoImagesWaiters/);
  assert.match(source, /onPhotoImagesStateChange=\{handlePhotoImagesStateChange\}/);
  assert.match(source, /const photoImagesState = photoImagesStateRef\.current;/);
  assert.match(source, /const photoSaveBlockMessage = getPhotoSaveBlockMessage\(photoImagesState\);/);
  assert.match(source, /if \(photoSaveBlockMessage\) \{\s*alert\(photoSaveBlockMessage\);\s*return;\s*\}/);

  const frameCheckIndex = source.indexOf("if (!frameType) {");
  const photoCheckIndex = source.indexOf("const photoImagesState = photoImagesStateRef.current;");
  assert.ok(frameCheckIndex !== -1 && frameCheckIndex < photoCheckIndex);
  [
    "setExportMode(true);",
    "const savedToBoothySession = await saveToBoothySession({",
    "if (exportExperience === 'share-sheet') {",
    "const fileHandle = await window.showSaveFilePicker({",
    "const downloadUrl = URL.createObjectURL(blob);",
  ].forEach((saveBranch) => {
    assert.ok(photoCheckIndex < source.indexOf(saveBranch), saveBranch);
  });
});

test("App은 직전 렌더에서 알린 사진 목록이 지금 문서와 다르면 저장을 막는다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /const photoImagesSourceRef = useRef<UserImage\[\] \| null>\(null\);/);
  assert.match(source, /photoImagesSourceRef\.current !== editorState\.userImages/);
  assert.ok(
    source.indexOf("photoImagesSourceRef.current !== editorState.userImages")
      < source.indexOf("const photoSaveBlockMessage = getPhotoSaveBlockMessage(photoImagesState);"),
  );
});

test("CanvasStage는 현재 문서 URL 기준으로 사진 로딩 상태를 알리고 늦은 콜백을 버린다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /const basePhotoImagesState = getPhotoImagesState\(userImages, loadedImages\);/);
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*onPhotoImagesStateChange\(photoImagesState, userImages\);\s*\}, \[onPhotoImagesStateChange, photoImagesStateKey, userImages\]\);/,
  );
  assert.match(source, /if \(!isCurrentPhotoLoad\(userImage\.id, userImage\.url, userImageUrlsRef\.current\)\) return;/);
  assert.match(source, /pendingLoad\.image\.onload = null;/);
  assert.match(source, /pendingLoad\.image\.onerror = null;/);
  assert.match(source, /if \(loadedImages\.get\(userImage\.id\)\?\.url === userImage\.url\) return;/);
  assert.match(source, /if \(activeImageUrls\.get\(imageId\) !== loadedEntry\.url\) \{/);
});

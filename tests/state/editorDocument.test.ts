import test from "node:test";
import assert from "node:assert/strict";

import {
  collectObjectUrls,
  collectUrlsToRevoke,
  hasEditorObject,
  isSameEditorDocument,
} from "../../src/state/editorDocument.ts";
import type {
  CanvasSticker,
  CanvasText,
  EditorDocument,
} from "../../src/state/editorDocument.ts";
import type { UserImage } from "../../src/types/frame.ts";

function makeImage(id: string, url: string): UserImage {
  return {
    id,
    file: new File([], "a.jpg"),
    url,
    slotId: "slot-1",
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };
}

function makeText(id: string): CanvasText {
  return {
    id,
    text: "테스트",
    x: 10,
    y: 20,
    boxWidth: 100,
    fontSize: 24,
    fontFamily: "NanumSquare",
    fontColor: "#000000",
    isBold: false,
    isItalic: false,
    isVertical: false,
    textAlign: "left",
    rotation: 0,
  };
}

function makeSticker(id: string, src = "/stickers/x.png"): CanvasSticker {
  return {
    id,
    src,
    x: 1,
    y: 2,
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    tintColor: null,
  };
}

function makeDocument(overrides: Partial<EditorDocument> = {}): EditorDocument {
  return {
    userImages: [makeImage("img-1", "blob:a")],
    texts: [makeText("text-1")],
    stickers: [makeSticker("sticker-1")],
    frameColor: "#ffffff",
    ...overrides,
  };
}

test("isSameEditorDocument는 같은 내용의 다른 객체 두 문서를 같다고 본다", () => {
  assert.equal(isSameEditorDocument(makeDocument(), makeDocument()), true);
});

test("isSameEditorDocument는 스티커 객체의 키 순서가 달라도 같다고 본다", () => {
  const orderedSticker: CanvasSticker = {
    id: "sticker-1",
    src: "/stickers/x.png",
    x: 1,
    y: 2,
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    tintColor: null,
  };
  const reorderedSticker: CanvasSticker = {
    tintColor: null,
    flipY: false,
    flipX: false,
    rotation: 0,
    scaleY: 1,
    scaleX: 1,
    height: 100,
    width: 100,
    y: 2,
    x: 1,
    src: "/stickers/x.png",
    id: "sticker-1",
  };

  assert.equal(
    isSameEditorDocument(
      makeDocument({ stickers: [orderedSticker] }),
      makeDocument({ stickers: [reorderedSticker] }),
    ),
    true,
  );
});

test("isSameEditorDocument는 스티커의 x 값이 다르면 다르다고 본다", () => {
  const movedSticker = { ...makeSticker("sticker-1"), x: 3 };

  assert.equal(
    isSameEditorDocument(makeDocument(), makeDocument({ stickers: [movedSticker] })),
    false,
  );
});

test("isSameEditorDocument는 서로 다른 File 객체를 같은 사진으로 본다", () => {
  const documentA = makeDocument();
  const documentB = makeDocument();

  assert.notEqual(documentA.userImages[0].file, documentB.userImages[0].file);
  assert.equal(isSameEditorDocument(documentA, documentB), true);
});

test("isSameEditorDocument는 프레임 색이 다르면 다르다고 본다", () => {
  assert.equal(isSameEditorDocument(makeDocument(), makeDocument({ frameColor: "#000000" })), false);
});

test("isSameEditorDocument는 값이 undefined인 키가 한쪽에만 있어도 같다고 본다", () => {
  const stickerWithCutout = { ...makeSticker("sticker-1"), cutout: undefined };

  assert.equal(
    isSameEditorDocument(makeDocument({ stickers: [stickerWithCutout] }), makeDocument()),
    true,
  );
});

test("hasEditorObject는 사진·글씨·스티커 id가 문서에 있는지 알려 준다", () => {
  const document = makeDocument();

  assert.equal(hasEditorObject(document, "img-1"), true);
  assert.equal(hasEditorObject(document, "text-9"), false);
});

test("collectObjectUrls는 사진 url과 blob 스티커 src만 모은다", () => {
  const document = makeDocument({
    userImages: [makeImage("img-1", "blob:a"), makeImage("img-2", "blob:b")],
    stickers: [makeSticker("sticker-1", "/stickers/x.png"), makeSticker("sticker-2", "blob:c")],
  });

  assert.deepEqual(collectObjectUrls(document), new Set(["blob:a", "blob:b", "blob:c"]));
});

test("collectUrlsToRevoke는 살아 있는 문서 어디에도 없는 URL을 오름차순으로 돌려준다", () => {
  const trackedUrls = ["blob:z", "blob:a", "blob:c"];
  const liveDocument = makeDocument({ userImages: [makeImage("img-1", "blob:c")] });

  assert.deepEqual(collectUrlsToRevoke(trackedUrls, [liveDocument]), ["blob:a", "blob:z"]);
});

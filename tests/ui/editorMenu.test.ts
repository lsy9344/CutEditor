import test from "node:test";
import assert from "node:assert/strict";

import { getDeletableSticker, getMenuAfterSelect, getSelectedMenu } from "../../src/ui/editorMenu.ts";

test("닫힌 패널은 무엇을 골라도 열지 않는다", () => {
  for (const selectedMenu of ["text", "sticker", "cutout", null] as const) {
    assert.equal(getMenuAfterSelect({ openMenu: null, selectedMenu }), null);
  }
});

test("프레임 패널은 무엇을 골라도 그대로 둔다", () => {
  for (const selectedMenu of ["text", "sticker", "cutout", null] as const) {
    assert.equal(getMenuAfterSelect({ openMenu: "frames", selectedMenu }), "frames");
  }
});

test("빈 곳이나 사진을 고르면 열린 패널을 그대로 둔다", () => {
  assert.equal(getMenuAfterSelect({ openMenu: "sticker", selectedMenu: null }), "sticker");
  assert.equal(getMenuAfterSelect({ openMenu: "cutout", selectedMenu: null }), "cutout");
  assert.equal(getMenuAfterSelect({ openMenu: "text", selectedMenu: null }), "text");
});

test("열린 패널에서 누끼 스티커를 고르면 내 사진 스티커 패널로 바뀐다", () => {
  assert.equal(getMenuAfterSelect({ openMenu: "sticker", selectedMenu: "cutout" }), "cutout");
  assert.equal(getMenuAfterSelect({ openMenu: "text", selectedMenu: "cutout" }), "cutout");
});

test("내 사진 스티커 패널에서 일반 스티커나 글씨를 고르면 그 메뉴로 바뀐다", () => {
  assert.equal(getMenuAfterSelect({ openMenu: "cutout", selectedMenu: "sticker" }), "sticker");
  assert.equal(getMenuAfterSelect({ openMenu: "cutout", selectedMenu: "text" }), "text");
  assert.equal(getMenuAfterSelect({ openMenu: "cutout", selectedMenu: "cutout" }), "cutout");
});

test("고른 대상의 메뉴는 글씨·누끼·일반 스티커로 나뉘고 사진과 빈 곳은 없다", () => {
  const texts = [{ id: "t1" }];
  const stickers = [{ id: "s1" }, { id: "c1", cutout: { imageId: "img-1" } }];
  assert.equal(getSelectedMenu({ id: "t1", texts, stickers }), "text");
  assert.equal(getSelectedMenu({ id: "s1", texts, stickers }), "sticker");
  assert.equal(getSelectedMenu({ id: "c1", texts, stickers }), "cutout");
  assert.equal(getSelectedMenu({ id: "img-1", texts, stickers }), null);
  assert.equal(getSelectedMenu({ id: null, texts, stickers }), null);
});

test("스티커 탭의 지우기는 일반 스티커만 지운다", () => {
  const plainSticker = { id: "s1" };
  const cutoutSticker = { id: "c1", cutout: { imageId: "img-1" } };
  assert.equal(getDeletableSticker({ panelTab: "sticker", selectedSticker: plainSticker }), plainSticker);
  assert.equal(getDeletableSticker({ panelTab: "sticker", selectedSticker: cutoutSticker }), undefined);
  assert.equal(getDeletableSticker({ panelTab: "sticker", selectedSticker: undefined }), undefined);
});

test("내 사진 스티커 탭의 지우기는 누끼 스티커만 지운다", () => {
  const plainSticker = { id: "s1" };
  const cutoutSticker = { id: "c1", cutout: { imageId: "img-1" } };
  assert.equal(getDeletableSticker({ panelTab: "cutout", selectedSticker: cutoutSticker }), cutoutSticker);
  assert.equal(getDeletableSticker({ panelTab: "cutout", selectedSticker: plainSticker }), undefined);
  assert.equal(getDeletableSticker({ panelTab: "cutout", selectedSticker: undefined }), undefined);
});

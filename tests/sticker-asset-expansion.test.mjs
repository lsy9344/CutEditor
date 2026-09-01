import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const catalogSource = readFileSync("src/ui/stickerCatalog.ts", "utf8");

test("흑백 일러스트 카테고리가 말풍선/화살표로 변경된다", () => {
  assert.match(catalogSource, /id: "point",/);
  assert.match(catalogSource, /label: "말풍선\/화살표",/);
  assert.match(catalogSource, /assetPrefix: "3s",/);
  assert.doesNotMatch(catalogSource, /label: "흑백 일러스트"/);
  assert.doesNotMatch(catalogSource, /label: "말풍선",/);
});

test("4s 말풍선 카테고리는 3s로 이관되어 제거된다", () => {
  assert.doesNotMatch(catalogSource, /assetPrefix: "4s"/);
  assert.doesNotMatch(catalogSource, /id: "bubble"/);
  assert.doesNotMatch(catalogSource, /\(1s\|2s\|3s\|4s\)/);
  assert.equal(existsSync("public/stickers/4s.png"), false, "4s.png 대표 이미지는 삭제되어야 한다");
  for (let index = 1; index <= 11; index += 1) {
    assert.equal(
      existsSync(`public/stickers/4s_${index}ss.png`),
      false,
      `4s_${index}ss.png는 삭제되어야 한다`,
    );
  }
});

test("카테고리별 슬롯 수가 재배치된 자산과 일치한다", () => {
  assert.match(catalogSource, /slotCount: 49,/);
  assert.match(catalogSource, /slotCount: 31,/);
  assert.doesNotMatch(catalogSource, /slotCount: 43,/);
  assert.doesNotMatch(catalogSource, /slotCount: 30,/);
});

test("3s에서 이동한 스티커가 1s 빈 자리와 뒤 슬롯에 존재한다", () => {
  for (const key of ["1s_8ss", "1s_12ss", "1s_15ss", "1s_19ss", "1s_44ss", "1s_45ss", "1s_46ss", "1s_47ss", "1s_48ss", "1s_49ss"]) {
    assert.equal(existsSync(`public/stickers/${key}.png`), true, `${key}.png 파일이 존재해야 한다`);
  }
});

test("삭제된 레터링 스티커 파일이 제거되었다", () => {
  for (const key of ["2s_1ss", "2s_14ss", "2s_15ss"]) {
    assert.equal(existsSync(`public/stickers/${key}.png`), false, `${key}.png는 삭제되어야 한다`);
    assert.equal(existsSync(`public/stickers/${key}.svg`), false, `${key}.svg는 삭제되어야 한다`);
  }
});

test("말풍선(3s)은 신규 버블 자산으로 채워진다", () => {
  for (const key of ["3s_1ss", "3s_2ss", "3s_10ss", "3s_11ss", "3s_13ss", "3s_18ss", "3s_31ss"]) {
    assert.equal(existsSync(`public/stickers/${key}.png`), true, `${key}.png 파일이 존재해야 한다`);
  }
  assert.equal(existsSync("public/stickers/3s_22ss.png"), false, "3s_22ss 갭은 유지된다");
  assert.equal(existsSync("public/stickers/3s_26ss.png"), false, "3s_26ss 갭은 유지된다");
});

test("재배치 후에도 자산 오디트가 실제 파일과 일치한다", async () => {
  const { STICKER_ASSET_AUDIT, buildStickerCandidatesForKey } = await loadTsModule("src/utils/stickerAssetCandidates.ts");

  for (const key of ["1s_8ss", "1s_12ss", "1s_44ss", "1s_49ss"]) {
    const audit = STICKER_ASSET_AUDIT[key];

    assert.ok(audit, `${key} 오디트 메타데이터가 존재해야 한다`);
    assert.equal(audit.svgContainsEmbeddedRaster, true, `${key} SVG는 래스터 포함으로 png-first여야 한다`);
    assert.equal(
      buildStickerCandidatesForKey(key)[0],
      `/stickers/${key}.png`,
      `${key}는 png-first 후보여야 한다`,
    );
  }

  for (const key of ["3s_1ss", "3s_13ss", "3s_31ss"]) {
    const audit = STICKER_ASSET_AUDIT[key];

    assert.ok(audit, `${key} 오디트 메타데이터가 존재해야 한다`);
    assert.equal(audit.svgContainsEmbeddedRaster, false, `${key}는 SVG가 없으므로 래스터 플래그가 없어야 한다`);
  }
});

test("기본(1s) 카테고리는 빈 슬롯 없이 전부 채워진다", () => {
  for (let index = 1; index <= 49; index += 1) {
    const key = `1s_${index}ss`;
    assert.equal(
      existsSync(`public/stickers/${key}.png`),
      true,
      `${key}.png 파일이 존재해야 한다`,
    );
  }
});

test("모든 후보가 실패한 슬롯은 갤러리에서 렌더링하지 않는다", () => {
  const panelSource = readFileSync("src/ui/EditorPanel.tsx", "utf8");
  const gallerySource = readFileSync("src/canvas/StickerGallery.tsx", "utf8");
  const filterPattern = /filter\(\(slot\) => \(stickerPreviewIndexes\[slot\.key\] \?\? 0\) < slot\.candidates\.length\)/;

  assert.match(panelSource, filterPattern, "EditorPanel 슬롯 필터");
  assert.match(gallerySource, filterPattern, "StickerGallery 슬롯 필터");
});

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const catalogSource = readFileSync("src/ui/stickerCatalog.ts", "utf8");

test("말풍선 카테고리(4s)가 카탈로그에 등록된다", () => {
  assert.match(catalogSource, /id: "bubble",/);
  assert.match(catalogSource, /label: "말풍선",/);
  assert.match(catalogSource, /assetPrefix: "4s",/);
  assert.match(catalogSource, /previewCandidates: buildStickerPath\("4s"\),/);
  assert.match(catalogSource, /stickers: buildStickerSlots\("4s", 11\),/);
  assert.match(catalogSource, /SVG_STICKER_SLOT_KEY_PATTERN = \/\^\(1s\|2s\|3s\|4s\)_\\d\+ss\$\//);

  assert.equal(existsSync("public/stickers/4s.png"), true, "4s.png 카테고리 대표 이미지가 존재해야 한다");
});

test("카테고리별 슬롯 수가 자산 수와 일치한다", () => {
  assert.match(catalogSource, /slotCount: 43,/);
  assert.match(catalogSource, /slotCount: 31,/);
  assert.match(catalogSource, /slotCount: 30,/);
  assert.match(catalogSource, /slotCount: 11,/);
});

test("신규 슬롯의 후보 경로는 키 기반 규칙을 따른다", async () => {
  const { buildStickerCandidatesForKey } = await loadTsModule("src/utils/stickerAssetCandidates.ts");

  for (const key of ["1s_21ss", "1s_43ss", "2s_23ss", "2s_31ss", "4s_1ss", "4s_11ss"]) {
    const candidates = buildStickerCandidatesForKey(key);

    assert.deepEqual(
      candidates.slice(0, 2),
      [`/stickers/${key}.svg`, `/stickers/${key}.png`],
      `${key} 후보 순서`,
    );
    assert.equal(existsSync(`public/stickers/${key}.png`), true, `${key}.png 파일이 존재해야 한다`);
  }
});

test("기본/레터링/말풍선 카테고리는 빈 슬롯 없이 전부 채워진다", () => {
  const ranges = [
    ["1s", 43],
    ["2s", 31],
    ["4s", 11],
  ];

  for (const [prefix, count] of ranges) {
    for (let index = 1; index <= count; index += 1) {
      const key = `${prefix}_${index}ss`;
      assert.equal(
        existsSync(`public/stickers/${key}.png`),
        true,
        `${key}.png 파일이 존재해야 한다`,
      );
    }
  }
});

test("3s는 기존 갭(22, 23, 26번)을 유지하고 숨은 슬롯이 노출된다", () => {
  for (const key of ["3s_22ss", "3s_23ss", "3s_26ss"]) {
    assert.equal(existsSync(`public/stickers/${key}.png`), false, `${key}.png는 없어야 한다`);
  }
  for (const key of ["3s_21ss", "3s_24ss", "3s_25ss", "3s_27ss", "3s_28ss", "3s_29ss", "3s_30ss"]) {
    assert.equal(existsSync(`public/stickers/${key}.png`), true, `${key}.png 파일이 존재해야 한다`);
  }
});

test("신규 자산 키가 자산 오디트에 등록되어 있다", async () => {
  const { STICKER_ASSET_AUDIT } = await loadTsModule("src/utils/stickerAssetCandidates.ts");

  for (const key of ["1s_21ss", "1s_43ss", "2s_23ss", "2s_31ss", "4s_1ss", "4s_11ss"]) {
    const audit = STICKER_ASSET_AUDIT[key];

    assert.ok(audit, `${key} 오디트 메타데이터가 존재해야 한다`);
    assert.equal(audit.pngHasTransparency, true, `${key} PNG는 투명 배경이어야 한다`);
  }
});

test("모든 후보가 실패한 슬롯은 갤러리에서 렌더링하지 않는다", () => {
  const panelSource = readFileSync("src/ui/EditorPanel.tsx", "utf8");
  const gallerySource = readFileSync("src/canvas/StickerGallery.tsx", "utf8");
  const filterPattern = /filter\(\(slot\) => \(stickerPreviewIndexes\[slot\.key\] \?\? 0\) < slot\.candidates\.length\)/;

  assert.match(panelSource, filterPattern, "EditorPanel 슬롯 필터");
  assert.match(gallerySource, filterPattern, "StickerGallery 슬롯 필터");
});

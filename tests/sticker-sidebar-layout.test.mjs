import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const svgStickerKeys = readdirSync("public/stickers")
  .filter((file) => /^[123]s_\d+ss\.svg$/.test(file))
  .map((file) => file.replace(/\.svg$/, ""))
  .sort();

test("기본 스티커 슬롯은 20개까지 생성된다", () => {
  const source = readFileSync("src/ui/stickerCatalog.ts", "utf8");

  assert.match(source, /export const STICKER_SLOT_COUNT = 20;/);
  assert.match(source, /const key = `\$\{prefix\}_\$\{index \+ 1\}ss`;/);
  assert.match(source, /candidates: buildStickerCandidates\(key\),/);
});

test("스티커 카탈로그는 키별 후보 우선순위 유틸을 사용한다", () => {
  const source = readFileSync("src/ui/stickerCatalog.ts", "utf8");

  assert.match(source, /import \{ buildStickerCandidatesForKey \} from "\.\.\/utils\/stickerAssetCandidates";/);
  assert.match(source, /return buildStickerCandidatesForKey\(key\);/);
});

test("실제 SVG 스티커 파일마다 PNG 대체 자산이 존재한다", () => {
  for (const key of svgStickerKeys) {
    assert.equal(existsSync(`public/stickers/${key}.png`), true, `${key}.png should exist`);
  }
});

test("실제 SVG 스티커 파일은 자산 성격에 맞는 우선순위를 사용한다", async () => {
  const {
    STICKER_ASSET_AUDIT,
    STICKER_RASTER_FIRST_KEYS,
    buildStickerCandidatesForKey,
  } = await loadTsModule("src/utils/stickerAssetCandidates.ts");
  const rasterFirstKeySet = new Set(STICKER_RASTER_FIRST_KEYS);

  for (const key of svgStickerKeys) {
    assert.equal(Boolean(STICKER_ASSET_AUDIT[key]), true, `${key} audit metadata should exist`);
    const candidates = buildStickerCandidatesForKey(key);
    if (rasterFirstKeySet.has(key)) {
      assert.equal(basename(candidates[0]), `${key}.png`);
      assert.equal(basename(candidates[1]), `${key}.svg`);
      continue;
    }

    assert.equal(basename(candidates[0]), `${key}.svg`);
    assert.equal(basename(candidates[1]), `${key}.png`);
  }
});

test("편집 패널 스티커 grid 간격은 현재 8px을 유지한다", () => {
  const source = readFileSync("src/ui/EditorPanel.tsx", "utf8");

  assert.match(
    source,
    /gridTemplateColumns:\s*"repeat\(3,\s*1fr\)",[\s\S]*gap:\s*"8px"/
  );
});

test("편집 패널 스티커 영역은 카드 높이 안에서 내부 스크롤을 유지한다", () => {
  const source = readFileSync("src/ui/EditorPanel.tsx", "utf8");

  assert.match(
    source,
    /<aside[\s\S]*minHeight:\s*0,[\s\S]*overflow:\s*'hidden'/
  );
});

test("편집 패널 스티커 스크롤 영역은 현재 여백 규칙을 유지한다", () => {
  const source = readFileSync("src/ui/EditorPanel.tsx", "utf8");

  assert.match(
    source,
    /marginTop:\s*'12px',[\s\S]*paddingRight:\s*'4px',[\s\S]*marginRight:\s*'0'/
  );
});

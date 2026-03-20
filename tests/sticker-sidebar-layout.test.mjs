import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const loadCatalog = async () =>
  loadTsModule("src/ui/stickerCatalog.ts");

const svgStickerKeys = readdirSync("public/stickers")
  .filter((file) => /^[123]s_\d+ss\.svg$/.test(file))
  .map((file) => file.replace(/\.svg$/, ""))
  .sort();

test("기본 스티커 슬롯은 20개까지 생성된다", async () => {
  const { STICKER_SLOT_COUNT, buildStickerSlots } = await loadCatalog();

  assert.equal(STICKER_SLOT_COUNT, 20);
  assert.equal(buildStickerSlots("1s").length, 20);
  assert.equal(buildStickerSlots("1s").at(-1)?.key, "1s_20ss");
});

test("1s_18ss 스티커는 모바일 호환을 위해 PNG를 먼저 시도한다", async () => {
  const { buildStickerCandidates, buildStickerSlots } = await loadCatalog();
  const targetSlot = buildStickerSlots("1s").find((slot) => slot.key === "1s_18ss");

  assert.ok(targetSlot);
  assert.deepEqual(targetSlot.candidates.slice(0, 2), [
    "/stickers/1s_18ss.png",
    "/stickers/1s_18ss.svg",
  ]);
  assert.deepEqual(buildStickerCandidates("2s_4ss").slice(0, 2), [
    "/stickers/2s_4ss.png",
    "/stickers/2s_4ss.svg",
  ]);
});

test("실제 SVG 스티커 파일마다 PNG 대체 자산이 존재한다", () => {
  for (const key of svgStickerKeys) {
    assert.equal(existsSync(`public/stickers/${key}.png`), true, `${key}.png should exist`);
  }
});

test("실제 SVG 스티커 파일은 모두 PNG를 먼저 시도한다", async () => {
  const { buildStickerCandidates } = await loadCatalog();

  for (const key of svgStickerKeys) {
    const candidates = buildStickerCandidates(key);
    assert.equal(basename(candidates[0]), `${key}.png`);
    assert.equal(basename(candidates[1]), `${key}.svg`);
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

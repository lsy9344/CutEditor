import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

const loadCatalog = async () =>
  loadTsModule("src/ui/stickerCatalog.ts");

test("기본 스티커 슬롯은 20개까지 생성된다", async () => {
  const { STICKER_SLOT_COUNT, buildStickerSlots } = await loadCatalog();

  assert.equal(STICKER_SLOT_COUNT, 20);
  assert.equal(buildStickerSlots("1s").length, 20);
  assert.equal(buildStickerSlots("1s").at(-1)?.key, "1s_20ss");
});

test("오른쪽 스티커 grid 간격은 현재 8px을 유지한다", () => {
  const source = readFileSync("src/ui/SidebarRight.tsx", "utf8");

  assert.match(
    source,
    /gridTemplateColumns:\s*"repeat\(3,\s*1fr\)",[\s\S]*gap:\s*"8px"/
  );
});

test("오른쪽 스티커 사이드바는 카드 높이 안에서 내부 스크롤을 유지한다", () => {
  const source = readFileSync("src/ui/SidebarRight.tsx", "utf8");

  assert.match(
    source,
    /<aside[\s\S]*minHeight:\s*0,[\s\S]*overflow:\s*'hidden'/
  );
});

test("오른쪽 스티커 스크롤 영역은 현재 여백 규칙을 유지한다", () => {
  const source = readFileSync("src/ui/SidebarRight.tsx", "utf8");

  assert.match(
    source,
    /marginTop:\s*'12px',[\s\S]*paddingRight:\s*'4px',[\s\S]*marginRight:\s*'0'/
  );
});

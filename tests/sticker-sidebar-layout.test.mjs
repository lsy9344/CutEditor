import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loadCatalog = async () =>
  import(`../src/ui/stickerCatalog.ts?ts=${Date.now()}`);

test("기본 스티커 슬롯은 20개까지 생성된다", async () => {
  const { STICKER_SLOT_COUNT, buildStickerSlots } = await loadCatalog();

  assert.equal(STICKER_SLOT_COUNT, 20);
  assert.equal(buildStickerSlots("1s").length, 20);
  assert.equal(buildStickerSlots("1s").at(-1)?.key, "1s_20ss");
});

test("오른쪽 스티커 grid 간격은 4px로 줄어든다", () => {
  const source = readFileSync("src/ui/SidebarRight.tsx", "utf8");

  assert.match(
    source,
    /gridTemplateColumns:\s*"repeat\(3,\s*1fr\)",[\s\S]*gap:\s*"4px"/
  );
});

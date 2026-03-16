import test from "node:test";
import assert from "node:assert/strict";
import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("스티커 편집 리셋은 좌우 반전만 바뀌어도 활성화된다", async () => {
  const { hasStickerEditChanges } = await loadTsModule("src/canvas/stickerEdit.ts");

  assert.equal(
    hasStickerEditChanges({
      flipX: true,
      flipY: false,
      tintColor: null,
    }),
    true,
  );
});

test("스티커 편집 리셋은 변경 사항이 없으면 비활성화된다", async () => {
  const { hasStickerEditChanges } = await loadTsModule("src/canvas/stickerEdit.ts");

  assert.equal(
    hasStickerEditChanges({
      flipX: false,
      flipY: false,
      tintColor: null,
    }),
    false,
  );
});

test("스티커 편집 리셋은 섹션 기본값으로 되돌린다", async () => {
  const { getStickerEditResetUpdates } = await loadTsModule("src/canvas/stickerEdit.ts");

  assert.deepEqual(getStickerEditResetUpdates(), {
    flipX: false,
    flipY: false,
    tintColor: null,
  });
});

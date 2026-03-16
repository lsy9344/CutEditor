import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadTsModule } from "./helpers/loadTsModule.mjs";

test("스티커 편집 리셋 가능 여부는 반전과 틴트 변경을 모두 반영한다", async () => {
  const { hasStickerEditChanges } = await loadTsModule("src/utils/stickerEdit.ts");

  assert.equal(
    hasStickerEditChanges({ flipX: false, flipY: false, tintColor: null }),
    false,
  );
  assert.equal(
    hasStickerEditChanges({ flipX: true, flipY: false, tintColor: null }),
    true,
  );
  assert.equal(
    hasStickerEditChanges({ flipX: false, flipY: true, tintColor: null }),
    true,
  );
  assert.equal(
    hasStickerEditChanges({ flipX: false, flipY: false, tintColor: "#ff0000" }),
    true,
  );
});

test("스티커 편집 리셋은 반전과 틴트를 기본값으로 되돌린다", async () => {
  const { getStickerEditResetUpdates } = await loadTsModule("src/utils/stickerEdit.ts");

  assert.deepEqual(getStickerEditResetUpdates(), {
    flipX: false,
    flipY: false,
    tintColor: null,
  });
});

test("CanvasStage 리셋 버튼은 스티커 편집 변경 여부로 활성화 상태를 결정한다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");

  assert.match(source, /disabled=\{!hasStickerEditChanges\(selectedSticker\)\}/);
  assert.match(
    source,
    /onClick=\{\(\) => onStickerUpdate\?\.\(selectedSticker\.id,\s*getStickerEditResetUpdates\(\)\)\}/,
  );
});

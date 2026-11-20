import test from "node:test";
import assert from "node:assert/strict";

import { CUTOUT_COPY } from "../../src/photo/cutoutCopy.ts";

test("흰 테두리는 켜짐/꺼짐 없이 한 이름만 쓴다", () => {
  assert.equal(CUTOUT_COPY.outline, "흰 테두리");
  assert.equal("outlineOn" in CUTOUT_COPY, false);
  assert.equal("outlineOff" in CUTOUT_COPY, false);
});

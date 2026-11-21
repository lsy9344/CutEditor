import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const canvasSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");
const labelsSource = readFileSync("src/state/editorLabels.ts", "utf8");

// 켠 토글(스티커 '좌우 뒤집기'·'위아래 뒤집기', 누끼 '흰 테두리')은 ✓를 보이게만 두고 접근 이름에서는 뺍니다. 상태는 aria-pressed가 알립니다.
const TOGGLE_MARKS = [
  { name: "좌우 뒤집기", mark: `{selectedSticker.flipX ? <span aria-hidden="true">✓ </span> : null}`, label: "좌우 뒤집기" },
  { name: "위아래 뒤집기", mark: `{selectedSticker.flipY ? <span aria-hidden="true">✓ </span> : null}`, label: "위아래 뒤집기" },
  { name: "흰 테두리", mark: `{outline ? <span aria-hidden="true">✓ </span> : null}`, label: "{CUTOUT_COPY.outline}" },
];

test("켠 토글의 ✓는 aria-hidden 표시로 보이고 글자는 켜든 끄든 같은 이름이다", () => {
  for (const { name, mark, label } of TOGGLE_MARKS) {
    const markIndex = canvasSource.indexOf(mark);
    assert.ok(markIndex >= 0, `${name}: ✓ 표시를 찾지 못했습니다`);
    const afterMark = canvasSource.slice(markIndex + mark.length, markIndex + mark.length + 80);
    assert.ok(afterMark.trimStart().startsWith(label), `${name}: ✓ 바로 뒤에 글자 '${label}'가 와야 합니다`);
  }
});

test("켠 토글 버튼은 aria-pressed로 상태를 알린다", () => {
  assert.ok(canvasSource.includes("aria-pressed={Boolean(selectedSticker.flipX)}"));
  assert.ok(canvasSource.includes("aria-pressed={Boolean(selectedSticker.flipY)}"));
  assert.ok(canvasSource.includes("aria-pressed={outline}"));
});

test("접근 이름에 ✓를 넣던 getToggleButtonLabel은 없어졌다", () => {
  assert.ok(!canvasSource.includes("getToggleButtonLabel"), "CanvasStage가 아직 부릅니다");
  assert.ok(!labelsSource.includes("getToggleButtonLabel"), "editorLabels에 남아 있습니다");
  assert.ok(!canvasSource.includes("`✓ ${"), "버튼 글자에 ✓를 붙이는 코드가 남아 있습니다");
});

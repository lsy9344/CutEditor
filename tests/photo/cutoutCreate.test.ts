import test from "node:test";
import assert from "node:assert/strict";

import { CUTOUT_COPY } from "../../src/photo/cutoutCopy.ts";
import {
  getCutoutNextStep,
  getCutoutNotFoundMessage,
  getCutoutPickButtons,
  getCutoutSubject,
  getPickChanges,
  getRestartChanges,
  getStartTarget,
} from "../../src/photo/cutoutCreate.ts";
import { getCutoutTargetKey } from "../../src/photo/cutoutTypes.ts";
import type { CutoutSource } from "../../src/photo/cutoutTypes.ts";
import { createHistory, pushHistory, undoHistory } from "../../src/state/history.ts";
import type { CanvasSticker } from "../../src/state/editorDocument.ts";

const baseSource: CutoutSource = {
  sourceImageId: "p1",
  target: { kind: "point", x: 0.3, y: 0.4 },
  outline: false,
  eraseStrokes: [
    { points: [0.1, 0.1], radius: 0.02 },
    { points: [0.2, 0.2], radius: 0.03 },
  ],
  crop: { x: 10, y: 20, width: 300, height: 200 },
  workingSize: { width: 1000, height: 800 },
};

test("종류가 없으면 사람으로 읽는다", () => {
  assert.equal(getCutoutSubject({}), "person");
  assert.equal(getCutoutSubject({ subject: "thing" }), "thing");
});

test("시작 대상은 사람이면 모두, 반려동물·물건이면 사진 가운데 점이다", () => {
  assert.deepEqual(getStartTarget("person"), { kind: "everyone" });
  assert.deepEqual(getStartTarget("thing"), { kind: "point", x: 0.5, y: 0.5 });
});

test("처음부터 다시는 종류의 시작 대상으로 테두리를 켜고 획을 비운다", () => {
  const personChanges = getRestartChanges({ ...baseSource, subject: "person" });
  assert.deepEqual(personChanges, { target: { kind: "everyone" }, outline: true, eraseStrokes: [] });
  assert.equal("subject" in personChanges, false);

  const thingChanges = getRestartChanges({ ...baseSource, subject: "thing" });
  assert.deepEqual(thingChanges.target, { kind: "point", x: 0.5, y: 0.5 });
  assert.equal("subject" in thingChanges, false);
});

test("고르기 버튼은 사람이 누른 대상일 때만 사람 모두를 더한다", () => {
  assert.deepEqual(getCutoutPickButtons({ subject: "person", target: { kind: "everyone" } }), ["pick"]);
  assert.deepEqual(getCutoutPickButtons({ subject: "person", target: { kind: "point", x: 0.3, y: 0.4 } }), [
    "pick",
    "everyone",
  ]);
  assert.deepEqual(getCutoutPickButtons({ subject: "thing", target: { kind: "point", x: 0.3, y: 0.4 } }), ["pick"]);
  assert.deepEqual(getCutoutPickButtons({ target: { kind: "point", x: 0.3, y: 0.4 } }), ["pick", "everyone"]);
});

test("가운데 자동과 정중앙 누름은 같은 캐시 키와 같은 버튼이다", () => {
  const startTarget = getStartTarget("thing");
  const pickedTarget = getPickChanges({ x: 0.5, y: 0.5 }).target;
  assert.equal(getCutoutTargetKey(startTarget), getCutoutTargetKey(pickedTarget));
  assert.deepEqual(
    getCutoutPickButtons({ subject: "thing", target: startTarget }),
    getCutoutPickButtons({ subject: "thing", target: pickedTarget }),
  );
});

test("찾으면 만들기와 첫 고르기는 붙이고 다시 고르기와 편집은 바꾼다", () => {
  assert.equal(getCutoutNextStep("create", true), "attach");
  assert.equal(getCutoutNextStep("first-pick", true), "attach");
  assert.equal(getCutoutNextStep("replace-pick", true), "replace");
  assert.equal(getCutoutNextStep("edit", true), "replace");
});

test("못 찾으면 만들기는 첫 고르기로, 고르기는 다시 누르기로, 편집은 이전 스티커를 둔다", () => {
  assert.equal(getCutoutNextStep("create", false), "enter-pick");
  assert.equal(getCutoutNextStep("first-pick", false), "retry-pick");
  assert.equal(getCutoutNextStep("replace-pick", false), "retry-pick");
  assert.equal(getCutoutNextStep("edit", false), "keep-previous");
});

test("못 찾음 안내는 시도에 따라 다르다", () => {
  assert.equal(getCutoutNotFoundMessage("create"), CUTOUT_COPY.notFound);
  assert.equal(getCutoutNotFoundMessage("first-pick"), CUTOUT_COPY.pickMissed);
  assert.equal(getCutoutNotFoundMessage("replace-pick"), CUTOUT_COPY.pickMissed);
  assert.equal(getCutoutNotFoundMessage("edit"), CUTOUT_COPY.editKept);
});

test("누른 점은 대상만 바꾸고 종류·획·테두리는 그대로다", () => {
  assert.deepEqual(getPickChanges({ x: 0.3, y: 0.4 }), { target: { kind: "point", x: 0.3, y: 0.4 } });

  const source: CutoutSource = { ...baseSource, subject: "thing", target: { kind: "point", x: 0.5, y: 0.5 } };
  const nextSource = { ...source, ...getPickChanges({ x: 0.7, y: 0.2 }) };
  assert.deepEqual(nextSource.target, { kind: "point", x: 0.7, y: 0.2 });
  assert.equal(nextSource.subject, source.subject);
  assert.equal(nextSource.outline, source.outline);
  assert.equal(nextSource.eraseStrokes, source.eraseStrokes);
  assert.equal(nextSource.crop, source.crop);
  assert.equal(nextSource.workingSize, source.workingSize);
});

test("옛 point 스티커와 반려동물·물건 스티커는 문서 저장과 되돌리기 뒤에도 버튼 규칙이 같다", () => {
  const makeSticker = (id: string, cutout: CutoutSource): CanvasSticker => ({
    id,
    src: `blob:${id}`,
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    tintColor: null,
    cutout,
  });
  const legacyPointSticker = makeSticker("s-legacy", { ...baseSource, target: { kind: "point", x: 0.3, y: 0.4 } });
  const thingSticker = makeSticker("s-thing", {
    ...baseSource,
    subject: "thing",
    target: { kind: "point", x: 0.5, y: 0.5 },
  });

  const savedDocument = JSON.parse(JSON.stringify({ stickers: [legacyPointSticker, thingSticker] })) as {
    stickers: CanvasSticker[];
  };
  const isSameDocument = (a: { stickers: CanvasSticker[] }, b: { stickers: CanvasSticker[] }) =>
    JSON.stringify(a) === JSON.stringify(b);
  const history = pushHistory(createHistory(savedDocument), { stickers: [] }, isSameDocument);
  const restored = undoHistory(history).present;

  const [restoredLegacy, restoredThing] = restored.stickers;
  assert.ok(restoredLegacy.cutout && restoredThing.cutout);
  assert.deepEqual(getCutoutPickButtons(restoredLegacy.cutout), ["pick", "everyone"]);
  assert.deepEqual(getCutoutPickButtons(restoredThing.cutout), ["pick"]);
  assert.deepEqual(getRestartChanges(restoredThing.cutout).target, { kind: "point", x: 0.5, y: 0.5 });
});

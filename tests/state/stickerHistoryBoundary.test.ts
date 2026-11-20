import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createHistory,
  pushHistory,
  undoHistory,
} from "../../src/state/history.ts";

const isSame = (a: string, b: string) => a === b;

test("스티커 삽입 직전 기록 경계가 앞선 색 변경과 삽입을 한 단계씩 나눈다", () => {
  let history = createHistory("base");
  let current = "color";

  history = pushHistory(history, current, isSame); // 삽입 직전 flushHistory()
  current = "color+sticker";

  history = undoHistory(pushHistory(history, current, isSame)); // 첫 되돌리기
  assert.equal(history.present, "color");
  current = history.present;

  history = undoHistory(pushHistory(history, current, isSame)); // 두 번째 되돌리기
  assert.equal(history.present, "base");
});

test("삽입 직전 경계가 없으면 한 번의 되돌리기에 색 변경까지 함께 사라진다", () => {
  let history = createHistory("base");
  const current = "color+sticker";

  history = undoHistory(pushHistory(history, current, isSame));

  assert.equal(history.present, "base");
});

test("App은 스티커 삽입 직전에 flushHistory를 호출하고 함수형 갱신으로 붙인다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /flushHistory\(\);\s*setStickers\(\(previous\) => \[\.\.\.previous, newSticker\]\);/,
  );
  assert.doesNotMatch(source, /pushSeparateStep/);
});

test("끌기 중 완료된 스티커는 끌기 종료 뒤 붙어 첫 되돌리기는 둘째만, 두 번째는 첫째를 시작 위치로 되돌린다", () => {
  let history = createHistory("base");
  let current = "base";
  const held: string[] = [];

  // 첫째 스티커를 끄는 동안 둘째 스티커의 치수 읽기가 끝나 보류한다.
  held.push("second");
  // 포인터를 놓아 첫째 스티커가 놓은 위치로 확정된다.
  current = "dragged";

  // 보류한 스티커를 붙이기 직전에 기록 경계를 닫고 하나만 붙인다.
  history = pushHistory(history, current, isSame);
  const nextHeldSticker = held.shift();
  assert.equal(nextHeldSticker, "second");
  current = `${current}+${nextHeldSticker}`;

  // 첫 되돌리기: 둘째만 사라지고 첫째는 놓은 위치에 남는다.
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "dragged");
  current = history.present;

  // 두 번째 되돌리기: 첫째가 시작 위치로 돌아간다.
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "base");
});

test("App은 포인터가 눌려 있거나 누끼 잠금 중이면 완료된 스티커를 보류하고 해제 뒤 렌더마다 하나씩 붙인다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /const heldStickerRef = useRef<CanvasSticker\[\]>\(\[\]\);/);
  assert.match(source, /const lastHeldStickerIdRef = useRef<string \| null>\(null\);/);
  assert.match(
    source,
    /const shouldHoldStickerInsert = useCallback\(\s*\(\) => isCutoutLocked\(\) \|\| hasActivePointers\(pointerPresenceRef\.current\),\s*\[\],\s*\);/,
  );
  assert.match(
    source,
    /if \(shouldHoldStickerInsert\(\)\) \{\s*heldStickerRef\.current\.push\(newSticker\);[^\n]*\n\s*return;\s*\}/,
  );
  assert.match(
    source,
    /\}, \[cutoutBusyId, currentDocument, flushHistory, isPointerActive, shouldHoldStickerInsert, selectInsertedSticker, stickers\]\);/,
  );
});

test("App은 앞서 꺼낸 보류 스티커가 문서에 반영된 뒤에만 다음 항목을 꺼내 기록 경계를 닫는다", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  const effectStart = source.indexOf("const nextHeldSticker = heldStickerRef.current[0];");
  assert.ok(effectStart >= 0, "보류 스티커를 하나씩 붙이는 effect를 찾지 못했습니다.");

  const effectEnd = source.indexOf("selectInsertedSticker(nextHeldSticker.id);", effectStart);
  assert.ok(effectEnd > effectStart);

  const effectBody = source.slice(effectStart, effectEnd);
  const previousCheckIndex = effectBody.indexOf(
    "lastHeldStickerId && !stickers.some((sticker) => sticker.id === lastHeldStickerId)",
  );
  const shiftIndex = effectBody.indexOf("heldStickerRef.current.shift();");
  const flushIndex = effectBody.indexOf("flushHistory();");
  const insertIndex = effectBody.indexOf("setStickers((previous) => [...previous, nextHeldSticker]);");

  assert.ok(previousCheckIndex >= 0, "직전 보류 id가 문서에 있는지 확인해야 합니다.");
  assert.ok(
    previousCheckIndex < shiftIndex,
    "반영 확인은 다음 보류 항목을 꺼내기 전에 해야 합니다.",
  );
  assert.ok(shiftIndex < flushIndex, "기록 경계는 다음 항목을 꺼낸 뒤 닫아야 합니다.");
  assert.ok(flushIndex < insertIndex, "기록 경계는 삽입 전에 닫아야 합니다.");
});

test("보류 스티커 두 건은 앞선 삽입이 문서에 반영된 뒤에만 다음 항목을 꺼내 각각 한 단계가 된다", () => {
  let history = createHistory("base");
  let current = "dragged"; // 첫째 스티커를 끌어 놓은 문서
  const held = ["A", "B"];
  const reflectedStickerIds: string[] = [];
  let lastHeldStickerId: string | null = null;
  let pendingInsert: string | null = null;

  const commitPendingInsert = () => {
    if (!pendingInsert) return;
    reflectedStickerIds.push(pendingInsert);
    current = `${current}+${pendingInsert}`;
    pendingInsert = null;
  };

  // 포인터를 뗀 뒤 렌더마다 실행되는 보류 삽입 effect를 흉내 낸다.
  const runHeldStickerEffect = () => {
    const nextHeldSticker = held[0];
    if (!nextHeldSticker) {
      lastHeldStickerId = null;
      return;
    }
    if (
      lastHeldStickerId
      && !reflectedStickerIds.includes(lastHeldStickerId)
    ) {
      return; // 앞서 꺼낸 스티커가 아직 문서에 반영되지 않았다.
    }

    held.shift();
    lastHeldStickerId = nextHeldSticker;
    history = pushHistory(history, current, isSame); // flushHistory()
    pendingInsert = nextHeldSticker; // 함수형 setStickers는 다음 렌더에 반영된다.
  };

  runHeldStickerEffect();
  assert.equal(pendingInsert, "A");
  assert.deepEqual(held, ["B"]);

  // 앞선 삽입이 커밋되기 전에 effect가 다시 실행돼도 다음 항목을 꺼내지 않는다.
  runHeldStickerEffect();
  assert.equal(pendingInsert, "A");
  assert.deepEqual(held, ["B"]);

  commitPendingInsert();

  // 반영 뒤에야 다음 항목을 꺼내고, 그 앞에서 기록 경계를 닫는다.
  runHeldStickerEffect();
  assert.equal(pendingInsert, "B");
  assert.deepEqual(held, []);
  commitPendingInsert();

  // 마지막 삽입은 다음 누름이나 400ms 뒤에 기록된다.
  history = pushHistory(history, current, isSame);
  assert.equal(history.present, "dragged+A+B");

  history = undoHistory(history);
  assert.equal(history.present, "dragged+A"); // 3 → 2
  history = undoHistory(history);
  assert.equal(history.present, "dragged"); // 2 → 1
  history = undoHistory(history);
  assert.equal(history.present, "base"); // 1 → 1, 끌기 전 위치 복원
});

test("보류 두 건 사이에 기록 경계가 없으면 한 번의 되돌리기에 함께 사라진다", () => {
  let history = createHistory("base");
  let current = "dragged";

  // 앞선 삽입의 반영을 기다리지 않고 두 건을 꺼내 경계를 한 번만 닫은 경우.
  history = pushHistory(history, current, isSame);
  current = "dragged+A+B";
  history = pushHistory(history, current, isSame);

  history = undoHistory(history);
  assert.equal(history.present, "dragged"); // 두 스티커가 함께 사라짐
});

test("App은 기록 경계를 호출 시점 문서로 고정해 같은 배치의 다음 변경과 섞지 않는다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(
    source,
    /const documentToRecord = currentDocumentRef\.current;\s*setHistory\(\(previous\) => pushHistory\(previous, documentToRecord, isSameEditorDocument\)\);/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createHistory,
  pushHistory,
  undoHistory,
} from "../../src/state/history.ts";

const isSame = (a: string, b: string) => a === b;

test("만들기 직전 기록 경계가 앞선 변경과 누끼를 나눠 되돌리기 한 번에 누끼만 사라진다", () => {
  let history = createHistory("base");
  let current = "photo"; // 썸네일을 누르는 사이에 반영된 변경(아직 기록 전)

  // 붙이기 앞 flushHistory(): 앞선 변경을 한 단계로 닫는다.
  history = pushHistory(history, current, isSame);
  current = "photo+cutout";
  // 잠금 해제의 flushHistory()
  history = pushHistory(history, current, isSame);

  history = undoHistory(history);
  assert.equal(history.present, "photo"); // 누끼만 사라짐
  current = history.present;

  // 대조: 붙이기 앞 flushHistory()가 없으면 앞선 변경까지 함께 사라진다.
  let controlHistory = createHistory("base");
  controlHistory = pushHistory(controlHistory, "photo+cutout", isSame);
  controlHistory = undoHistory(controlHistory);
  assert.equal(controlHistory.present, "base");

  const source = readFileSync("src/App.tsx", "utf8");
  assert.match(
    source,
    /flushHistory\(\);\s*setStickers\(\(previous\) => \[\.\.\.previous, newSticker\]\);/,
  );
});

test("잠금 중 끝나 보류된 Boothy 사진은 누끼 다음 단계로 붙고 되돌리면 사진만 사라진다", () => {
  let history = createHistory("base");
  let current = "base";

  // 누끼 붙이기 앞 flushHistory()
  history = pushHistory(history, current, isSame);
  current = "cutout";
  // 잠금 해제 첫 effect의 flushHistory()
  history = pushHistory(history, current, isSame);
  // 보류한 Boothy 사진 적용
  current = "cutout+photo";

  // 첫 되돌리기: 사진만 사라짐
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "cutout");
  current = history.present;

  // 두 번째 되돌리기: 누끼만 사라짐
  history = undoHistory(pushHistory(history, current, isSame));
  assert.equal(history.present, "base");

  // 대조: 첫 effect의 flushHistory()가 없으면 누끼까지 함께 사라진다.
  let controlHistory = createHistory("base");
  controlHistory = pushHistory(controlHistory, "base", isSame);
  controlHistory = undoHistory(pushHistory(controlHistory, "cutout+photo", isSame));
  assert.equal(controlHistory.present, "base");

  const source = readFileSync("src/App.tsx", "utf8");
  assert.match(source, /if \(cutoutBusyId\) return;\s*flushHistory\(\);/);
  assert.match(
    source,
    /if \(isCutoutLocked\(\)\) \{\s*heldBoothyImportRef\.current = \{ file, slotId: pendingBoothyImport\.slotId \};/,
  );
});

function getCutoutCreateBody(): string {
  const source = readFileSync("src/App.tsx", "utf8");
  const start = source.indexOf("const handleCutoutCreate = async (imageId: string) => {");
  assert.ok(start >= 0, "handleCutoutCreate를 찾지 못했습니다.");

  const end = source.indexOf("const handleStickerUpdate =", start);
  assert.ok(end > start, "handleCutoutCreate의 끝을 찾지 못했습니다.");

  return source.slice(start, end);
}

test("잠금 중 끝난 Boothy 사진과 일반 스티커 두 개는 사진 다음 렌더에서 완료 순서대로 한 단계씩 붙는다", () => {
  let history = createHistory("base");
  let current = "cutout"; // 누끼 결과가 반영된 문서

  // 잠금 해제 effect의 flushHistory(): 누끼까지를 한 단계로 닫음
  history = pushHistory(history, current, isSame);

  // 같은 잠금 해제 배치에서 Boothy 사진만 먼저 반영하고, 스티커는 다음 렌더로 미룸
  current = "cutout+boothy";
  history = pushHistory(history, current, isSame);
  current = "cutout+boothy+A";
  history = pushHistory(history, current, isSame);
  current = "cutout+boothy+A+B";

  // 되돌릴 때마다 늦게 붙은 스티커부터 하나씩, 사진, 누끼, 처음 사진 순서로 사라진다.
  const undoOrder: string[] = [];
  for (let step = 0; step < 4; step += 1) {
    history = undoHistory(pushHistory(history, current, isSame));
    current = history.present;
    undoOrder.push(current);
  }
  assert.deepEqual(undoOrder, ["cutout+boothy+A", "cutout+boothy", "cutout", "base"]);

  // 대조: 스티커를 Boothy 사진과 같은 배치에 붙이면 사진과 스티커가 함께 사라진다.
  let controlHistory = createHistory("base");
  controlHistory = pushHistory(controlHistory, "cutout", isSame);
  controlHistory = undoHistory(pushHistory(controlHistory, "cutout+boothy+A+B", isSame));
  assert.equal(controlHistory.present, "cutout");

  const source = readFileSync("src/App.tsx", "utf8");
  assert.match(
    source,
    /const shouldHoldStickerInsert = useCallback\(\s*\(\) => isCutoutLocked\(\) \|\| hasActivePointers\(pointerPresenceRef\.current\),\s*\[\],\s*\);/,
  );
  assert.doesNotMatch(
    source,
    /if \(isCutoutLocked\(\)\) \{\s*heldStickerRef\.current\.push\(newSticker\);/,
  );
  assert.equal((source.match(/heldStickerRef\.current\.shift\(\)/g) ?? []).length, 1);
  assert.match(
    source,
    /if \(heldImport\) \{\s*boothyReleasePendingRef\.current = true;[\s\S]*?handleImageUpload\(heldImport\.file, heldImport\.slotId\);/,
  );
  assert.match(
    source,
    /if \(boothyReleasePendingRef\.current\) \{[\s\S]*?boothyReleasePendingRef\.current = false;[\s\S]*?return;\s*\}\s*if \(cutoutBusyId \|\| shouldHoldStickerInsert\(\)\) return;/,
  );
  assert.match(
    source,
    /\}, \[cutoutBusyId, currentDocument, flushHistory, isPointerActive, shouldHoldStickerInsert, selectInsertedSticker, stickers\]\);/,
  );
});

test("계산 직후 취소가 처리되면 사람 없음 안내와 스티커가 남지 않는다", () => {
  const body = getCutoutCreateBody();
  const yieldCount = (body.match(/await new Promise<void>\(\(resolve\) => \{\s*setTimeout\(resolve, 0\);\s*\}\);/g) ?? []).length;

  // 성공·사람 없음 결과를 반영하기 전 한 번, 오류를 반영하기 전 한 번, 같은 경계를 둔다.
  // 한 번의 0ms 대기로는 브라우저가 이미 예약한 취소 클릭 태스크보다 먼저 깨어날 수 있어 두 번 기다린다.
  assert.equal(yieldCount, 4);
  assert.match(
    body,
    /const result = await renderCutoutSticker\([\s\S]*?if \(result\.kind === "ok"\) pendingUrl = result\.url;[\s\S]*?await new Promise<void>\(\(resolve\) => \{\s*setTimeout\(resolve, 0\);\s*\}\);\s*await new Promise<void>\(\(resolve\) => \{\s*setTimeout\(resolve, 0\);\s*\}\);\s*if \(isCancelled\(\)\) return;\s*if \(result\.kind === "not-found"\) \{\s*setCutoutError\(/,
  );
  assert.match(
    body,
    /\} catch \{\s*await new Promise<void>\(\(resolve\) => \{\s*setTimeout\(resolve, 0\);\s*\}\);\s*await new Promise<void>\(\(resolve\) => \{\s*setTimeout\(resolve, 0\);\s*\}\);\s*(?:\/\/[^\n]*\n\s*)*if \(!isCancelled\(\)\) setCutoutError\(/,
  );
});

test("누르고 있는 동안 끝난 누끼도 성공 경로 한 곳에서 캐시를 등록하고 모바일 시트를 닫는다", () => {
  const body = getCutoutCreateBody();

  // 누끼 결과는 일반 스티커 보류 목록을 거치지 않는다.
  assert.doesNotMatch(body, /heldStickerRef/);
  assert.doesNotMatch(body, /shouldHoldStickerInsert/);

  const applyIndex = body.indexOf("setStickers((previous) => [...previous, newSticker]);");
  const workingCanvasIndex = body.indexOf("setCutoutWorkingCanvas(newSticker.id, workingCanvas);");
  const confidenceIndex = body.indexOf('rememberCutoutConfidence(newSticker.id, { kind: "everyone" }, confidence);');
  const loadingIndex = body.indexOf('setCutoutImagesState({ kind: "loading" });');
  const mobilePanelIndex = body.indexOf("setMobilePanel(null);", applyIndex);

  assert.ok(applyIndex >= 0, "스티커 붙이기를 찾지 못했습니다.");
  assert.ok(workingCanvasIndex > applyIndex, "작업 캔버스 등록은 붙이기와 같은 성공 경로에 있어야 합니다.");
  assert.ok(confidenceIndex > workingCanvasIndex, "confidence 등록은 작업 캔버스 등록 뒤여야 합니다.");
  assert.ok(loadingIndex > confidenceIndex, "저장 막기는 캐시 등록 뒤 같은 배치여야 합니다.");
  assert.ok(mobilePanelIndex > loadingIndex, "모바일 시트 닫기는 같은 성공 경로의 마지막 배치에 있어야 합니다.");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");

test("App에는 옛 저장 코드(alert, Boothy 저장 카드, 옛 파일 이름)가 없다", () => {
  const removedCode = [
    "alert(",
    "BOOTHY_SAVE_NOTICE_AUTO_CLOSE_MS",
    "boothySaveNoticeState",
    "makeSuggestedFilename",
    "cut_export_",
    "supportsFilePicker",
    "showMissingStickerNotice",
  ];

  for (const code of removedCode) {
    assert.ok(!appSource.includes(code), `옛 코드가 남아 있습니다: ${code}`);
  }
});

test("저장 입구는 모두 handleSaveRequest다", () => {
  const requiredCode = [
    "onExport={handleSaveRequest}",
    "onClick={handleSaveRequest}",
    "onExport: handleSaveRequest",
  ];
  const removedCode = [
    "onClick={handleExport}",
    "onExport={handleExport}",
    "onExport: handleExport",
  ];

  for (const code of requiredCode) {
    assert.ok(appSource.includes(code), `App에서 찾지 못했습니다: ${code}`);
  }
  for (const code of removedCode) {
    assert.ok(!appSource.includes(code), `옛 저장 입구가 남아 있습니다: ${code}`);
  }
});

const getAppSection = (startMarker: string, endMarker: string): string => {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `App에서 구간을 찾지 못했습니다: ${startMarker}`);
  return appSource.slice(start, end);
};

// UX3-1·UX3-3: 준비 확인은 렌더 직전 한 번이다. 두 프레임 기다린 뒤 읽은 캔버스 하나를 확인하고 그 캔버스로 렌더한다.
test("저장은 렌더 직전 캔버스를 준비·확인하는 함수를 흐름에 넘기고 옛 클릭 때 캔버스 비교는 없다", () => {
  const exportBody = getAppSection("const handleExport = async", "// 모바일: '사진에 저장' 버튼 핸들러");
  assert.ok(exportBody.includes("prepareCanvas:"), "저장 흐름에 캔버스 준비 함수를 넘기지 않습니다");
  for (const oldCode of ["isCanvasReady", "stageAtClick", "stageRef.current === "]) {
    assert.ok(!exportBody.includes(oldCode), `옛 클릭 때 캔버스 비교가 남아 있습니다: ${oldCode}`);
  }
  assert.ok(exportBody.includes("result.kind === 'photos-not-ready'"), "준비 안 돼 멈춘 결과를 처리하지 않습니다");
  const notReadyBranch = getAppSection("result.kind === 'photos-not-ready'", "result.kind === 'photos-failed'");
  assert.ok(notReadyBranch.includes("retrySaveRef.current = result.retry"), "멈춘 저장의 경로·이름·핸들을 남기지 않습니다");
  assert.ok(notReadyBranch.includes("isWaitingForPhotos: true"), "기존 사진 기다림 안내를 쓰지 않습니다");
});

test("사진 로드 실패로 멈춘 저장은 경로·이름·핸들을 남기고 기존 사진 실패 안내를 보인다", () => {
  const failedBranch = getAppSection("result.kind === 'photos-failed'", "if (result.kind === 'failed')");
  assert.ok(failedBranch.includes("retrySaveRef.current = result.retry"), "멈춘 저장의 경로·이름·핸들을 남기지 않습니다");
  assert.ok(failedBranch.includes("setNotice(null)"), "진행 안내를 닫지 않습니다");
  assert.ok(failedBranch.includes("message: PHOTO_FAILED_SAVE_MESSAGE"), "기존 사진 실패 안내를 쓰지 않습니다");
});

test("캔버스 준비 함수는 두 프레임 기다린 뒤 캔버스를 한 번만 읽어 판단하고 렌더에는 그 캔버스를 넘긴다", () => {
  const prepare = getAppSection("prepareCanvas: async", "render: (stage)");
  assert.equal(prepare.split("stageRef.current").length - 1, 1, "캔버스를 한 번만 읽지 않습니다");
  assert.ok(
    prepare.indexOf("requestAnimationFrame") < prepare.indexOf("const stage = stageRef.current;"),
    "두 프레임을 기다리기 전에 캔버스를 읽습니다",
  );
  assert.ok(prepare.includes("readCanvasPreparation(stage)"), "읽은 캔버스를 그대로 확인하지 않습니다");
  const render = getAppSection("render: (stage)", "saveToBoothy:");
  assert.ok(render.includes("exportBlobFromStage({ frameType, stage })"), "확인한 캔버스로 렌더하지 않습니다");
  assert.ok(!render.includes("stageRef"), "렌더에서 캔버스를 다시 읽고 있습니다");
  const flowCall = getAppSection("const result = await runSaveFlow(", "if (result.kind === 'photos-not-ready')");
  assert.equal(flowCall.split("stageRef.current").length - 1, 1, "저장 흐름 안에서 캔버스를 여러 번 읽습니다");
});

test("준비 판단은 클릭 때의 클로저 값이 아니라 지금 ref와 보고한 캔버스를 읽는다", () => {
  const readiness = getAppSection("const readCanvasPreparation = ", "const activeCategory");
  for (const refRead of [
    "getCanvasPreparation(",
    "reportedStageRef.current",
    "photoImagesSourceRef.current",
    "currentDocumentRef.current.userImages",
    "photoImagesStateRef.current",
    "cutoutImagesStateRef.current",
  ]) {
    assert.ok(readiness.includes(refRead), `지금 값을 읽지 않습니다: ${refRead}`);
  }
  assert.ok(!readiness.includes("editorState.userImages"), "클릭 때의 사진 목록을 읽고 있습니다");
  assert.ok(!readiness.includes("cutoutImagesState.kind"), "클릭 때의 누끼 상태를 읽고 있습니다");
  const waiting = getAppSection("const isSaveWaitingForImages = ", "const activeCategory");
  assert.ok(waiting.includes("readCanvasPreparation(stageRef.current)"), "다시 저장하기 대기 판단이 같은 판단을 쓰지 않습니다");
});

test("사진·누끼 준비 보고는 낸 캔버스를 함께 담고 App은 그 캔버스를 ref 하나로 기억한다", () => {
  const canvasSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");
  assert.match(canvasSource, /onPhotoImagesStateChange\(photoImagesState, userImages, stageRef\.current\);/);
  assert.match(canvasSource, /onCutoutImagesStateChange\(cutoutImagesState, stageRef\.current\);/);
  assert.equal(appSource.split("const reportedStageRef = useRef<Konva.Stage | null>(null)").length - 1, 1, "보고한 캔버스 ref가 하나가 아닙니다");
  const photoReport = getAppSection("const handlePhotoImagesStateChange = ", "const handleCutoutImagesStateChange = ");
  assert.ok(photoReport.includes("reportedStageRef.current = stage"), "사진 보고가 낸 캔버스를 기억하지 않습니다");
  const cutoutReport = getAppSection("const handleCutoutImagesStateChange = ", "useEffect(() => {");
  assert.ok(cutoutReport.includes("reportedStageRef.current = stage"), "누끼 보고가 낸 캔버스를 기억하지 않습니다");
  assert.ok(cutoutReport.includes("cutoutImagesStateRef.current = state"), "누끼 보고를 바로 ref에 쓰지 않습니다");
  assert.ok(appSource.includes("onCutoutImagesStateChange={handleCutoutImagesStateChange}"), "누끼 보고를 새 함수로 받지 않습니다");
});

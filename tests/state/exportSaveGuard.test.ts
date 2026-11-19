import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function getHandleExportBody(): string {
  const source = readFileSync("src/App.tsx", "utf8");
  const start = source.indexOf("const handleExport = async () => {");
  assert.ok(start >= 0, "handleExport를 찾지 못했습니다.");

  const end = source.indexOf("// 모바일: '사진에 저장' 버튼 핸들러", start);
  assert.ok(end > start, "handleExport의 끝을 찾지 못했습니다.");

  return source.slice(start, end);
}

test("App은 사진 준비 확인을 통과한 저장에서 Stage를 만지기 전에 동기 ref로 중복 진입을 막는다", () => {
  const body = getHandleExportBody();

  const photoCheckIndex = body.indexOf("const photoSaveBlockMessage = getPhotoSaveBlockMessage(photoImagesState);");
  const acquireIndex = body.indexOf("exportInFlightRef.current = true;");
  const stageIndex = body.indexOf("const stage = stageRef.current;");
  const exportModeIndex = body.indexOf("setExportMode(true);");

  assert.ok(photoCheckIndex >= 0, "사진 준비 확인을 찾지 못했습니다.");
  assert.ok(acquireIndex > photoCheckIndex, "중복 진입 막음은 사진 준비 확인 뒤에 있어야 합니다.");
  assert.ok(stageIndex > acquireIndex, "중복 진입 막음은 Stage 접근 전에 있어야 합니다.");
  assert.ok(exportModeIndex > acquireIndex, "중복 진입 막음은 exportMode를 켜기 전에 있어야 합니다.");
  assert.match(
    body,
    /if \(exportInFlightRef\.current\) return;\s*exportInFlightRef\.current = true;\s*\n\s*try \{/,
    "이미 저장 중이면 아무것도 하지 않고 return한 뒤 try로 들어가야 합니다.",
  );
});

test("App은 저장의 finally에서 중복 진입 막음을 해제해 다음 저장이 정상 시작되게 한다", () => {
  const body = getHandleExportBody();
  const finallyIndex = body.lastIndexOf("} finally {");

  assert.ok(finallyIndex >= 0, "handleExport의 finally를 찾지 못했습니다.");

  const releaseIndex = body.indexOf("exportInFlightRef.current = false;", finallyIndex);
  const exportModeIndex = body.indexOf("setExportMode(false);", finallyIndex);

  assert.ok(releaseIndex > finallyIndex, "finally에서 중복 진입 막음을 해제해야 합니다.");
  assert.ok(exportModeIndex > releaseIndex, "막음 해제는 exportMode 복원과 함께 finally에 있어야 합니다.");
});

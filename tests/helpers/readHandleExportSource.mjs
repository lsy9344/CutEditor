import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// App.tsx에서 저장 흐름(handleExport) 본문만 잘라 온다.
export function readHandleExportSource() {
  const source = readFileSync("src/App.tsx", "utf8");
  const start = source.indexOf("const handleExport = async () => {");
  const end = source.indexOf("const openExportPreview = ");
  assert.ok(start >= 0 && end > start, "handleExport를 찾지 못했습니다");
  return source.slice(start, end);
}

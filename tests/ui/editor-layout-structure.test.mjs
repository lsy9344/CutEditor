import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App은 데스크톱 네비게이션 레일과 편집 패널 컴포넌트를 사용한다", () => {
  const source = readFileSync("src/App.tsx", "utf8");

  assert.match(source, /import\s+\{\s*DesktopNavigationRail\s*\}\s+from\s+['"]\.\/ui\/DesktopNavigationRail['"]/);
  assert.match(source, /import\s+\{\s*EditorPanel\s*\}\s+from\s+['"]\.\/ui\/EditorPanel['"]/);
  assert.match(source, /<DesktopNavigationRail/);
  assert.match(source, /<EditorPanel/);
  assert.doesNotMatch(source, /SidebarRight/);
});

test("데스크톱 네비게이션 레일 컴포넌트 파일은 프레임과 저장 액션을 제공한다", () => {
  const source = readFileSync("src/ui/DesktopNavigationRail.tsx", "utf8");

  assert.match(source, /export type DesktopNavigationRailProps/);
  assert.match(source, /프레임/);
  assert.match(source, /글씨/);
  assert.match(source, /스티커/);
  assert.match(source, /저장/);
});

test("편집 패널 컴포넌트 파일은 EditorPanel 이름으로 export된다", () => {
  const source = readFileSync("src/ui/EditorPanel.tsx", "utf8");

  assert.match(source, /export type EditorPanelProps/);
  assert.match(source, /export const EditorPanel/);
});

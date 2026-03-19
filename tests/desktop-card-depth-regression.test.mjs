import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("데스크톱 좌측 패널과 중앙 캔버스 래퍼는 카드 그림자가 잘리지 않도록 전용 클래스를 사용한다", () => {
  const appSource = readFileSync("src/App.tsx", "utf8");

  assert.match(appSource, /app-desktop-side-panel/);
  assert.match(appSource, /app-desktop-center-panel/);
});

test("데스크톱 좌측 패널과 중앙 캔버스 래퍼 스타일은 overflow visible로 카드 음영을 노출한다", () => {
  const cssSource = readFileSync("src/components/components.css", "utf8");

  assert.match(
    cssSource,
    /\.app-desktop-side-panel\s*\{[\s\S]*overflow:\s*visible;/
  );
  assert.match(
    cssSource,
    /\.app-desktop-center-panel\s*\{[\s\S]*overflow:\s*visible;/
  );
});

test("좌측 프레임 카드 스크롤 영역은 카드 그림자와 hover 이동분을 위한 여백을 확보한다", () => {
  const sidebarSource = readFileSync("src/ui/SidebarLeft.tsx", "utf8");
  const cssSource = readFileSync("src/components/components.css", "utf8");

  assert.match(sidebarSource, /className=\"frame-gallery-scroll\"/);
  assert.match(
    cssSource,
    /\.frame-gallery-scroll\s*\{[\s\S]*overflow-y:\s*auto;[\s\S]*padding:\s*2px 6px 6px 2px;/
  );
});

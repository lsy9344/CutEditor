import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stageSource = readFileSync("src/canvas/CanvasStage.tsx", "utf8");
const textLayerStart = stageSource.indexOf("{/* 텍스트 레이어 (최상위에 표시) */}");
const textLayerEnd = stageSource.indexOf("</Layer>", textLayerStart);
const textLayerSource = stageSource.slice(textLayerStart, textLayerEnd);

test("글씨 레이어는 렌더 안에서 컴포넌트를 새로 정의하지 않는다(누를 때 다시 그려져도 같은 Konva 노드를 유지)", () => {
  assert.ok(textLayerStart > 0, "텍스트 레이어 주석을 찾지 못했습니다");
  // 렌더마다 새로 정의한 컴포넌트는 부모가 다시 그려질 때마다 새 타입이 되어 Konva Text를 다시 만든다.
  // 그러면 누르는 순간(App의 isPointerActive 변경) 끌기·클릭·크기 조절이 끊긴다.
  assert.doesNotMatch(textLayerSource, /\b(?:const|let|var|function)\s+[A-Z]\w*\b/);
  assert.match(textLayerSource, /textNodeRefs\.current\[textItem\.id\] = node/);
});

test("글씨 Transformer는 마운트 조건(저장 중 여부·선택·글씨 목록)이 바뀔 때마다 같은 글씨 노드에 다시 붙는다", () => {
  const effect = stageSource.match(
    /useEffect\(\(\) => \{\s*texts\.forEach\(\(textItem\) => \{\s*const node = textNodeRefs\.current\[textItem\.id\];[\s\S]*?\}, \[([^\]]*)\]\);/,
  );
  assert.ok(effect, "글씨 Transformer 연결 effect를 찾지 못했습니다");
  assert.match(effect[0], /findOne\(`#transformer-text-\$\{textItem\.id\}`\)[\s\S]*tr\.nodes\(\[node\]\)/);
  const dependencies = effect[1].split(",").map((name) => name.trim());
  for (const name of ["exportMode", "selection", "texts"]) {
    assert.ok(dependencies.includes(name), `effect 의존성에 ${name}이 없습니다`);
  }
  assert.match(textLayerSource, /\{isSelected && !exportMode && \(\s*<Transformer\s+id=\{`transformer-text-\$\{textItem\.id\}`\}/);
});

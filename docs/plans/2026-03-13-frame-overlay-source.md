# Frame Overlay Source Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 편집 캔버스가 미리보기용 `popover` 이미지가 아니라 실제 프레임 오버레이만 사용하도록 고친다.

**Architecture:** 프레임 미리보기와 편집 오버레이의 역할을 분리한다. `CanvasStage`의 프레임 로더는 `/frame/...` 계열만 후보로 사용하고, 갤러리/사이드바 미리보기는 기존처럼 `popover`를 유지한다.

**Tech Stack:** React, TypeScript, node:test

---

### Task 1: 회귀 테스트 추가

**Files:**
- Create: `tests/canvas-frame-overlay-source.test.mjs`
- Test: `tests/canvas-frame-overlay-source.test.mjs`

**Step 1: Write the failing test**

```js
test("CanvasStage는 popover 이미지를 프레임 오버레이 후보에 포함하지 않는다", () => {
  const source = readFileSync("src/canvas/CanvasStage.tsx", "utf8");
  assert.doesNotMatch(source, /`\/popover\/\$\{frameType\}\.png`/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/canvas-frame-overlay-source.test.mjs`
Expected: FAIL because `CanvasStage.tsx` still includes the `popover` fallback.

**Step 3: Write minimal implementation**

```ts
const candidates = new Set<string>([
  primaryPath,
  `/frame/${frameType}.png`,
]);
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/canvas-frame-overlay-source.test.mjs`
Expected: PASS

### Task 2: 전체 관련 검증

**Files:**
- Modify: `src/canvas/CanvasStage.tsx`
- Verify only: `src/ui/SidebarLeft.tsx`
- Verify only: `src/canvas/FrameGallery.tsx`

**Step 1: Confirm preview code still uses popover**

```ts
return previewSources[option.value] ?? `/popover/${option.image}`;
```

**Step 2: Run focused verification**

Run: `node --test tests/canvas-frame-overlay-source.test.mjs tests/mobile-editor-layout.test.mjs tests/canvas-ratio-normalization.test.mjs`
Expected: PASS

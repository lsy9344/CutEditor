# Text Alignment Box Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 선택된 텍스트의 정렬 기준을 캔버스 전체가 아니라 현재 조절 박스 내부로 바꾼다.

**Architecture:** `CanvasText`에 정렬 기준 폭을 저장하고, `Konva.Text`의 `width`와 `align`을 사용해 박스 내부 정렬을 구현한다. 텍스트 리사이즈는 Transformer에서 박스 폭을 갱신하고, 정렬 변경은 폭만 유지한 채 박스 내부 배치만 바꾼다.

**Tech Stack:** React, TypeScript, react-konva, node:test

---

### Task 1: 실패 테스트 추가

**Files:**
- Modify: `tests/canvas-keyboard-shortcuts.test.mjs`

**Step 1: Write the failing test**

- `CanvasText`가 `boxWidth`를 갖는지
- `handleTextAlignChange`가 `x`를 재정렬하지 않도록 필요한 패턴이 있는지
- `Konva.Text`가 `width={textItem.boxWidth}`를 사용하는지 검증한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/canvas-keyboard-shortcuts.test.mjs`

**Step 3: Write minimal implementation**

- 텍스트 타입과 렌더링/업데이트 로직에 `boxWidth`를 추가한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/canvas-keyboard-shortcuts.test.mjs`

### Task 2: 텍스트 박스 정렬 구현

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/canvas/CanvasStage.tsx`

**Step 1: Add text box width state**

- 텍스트 삽입 시 기본 `boxWidth`를 계산한다.
- 정렬 계산은 캔버스 기준 재배치 대신 박스 폭 보정만 수행한다.

**Step 2: Persist resize result**

- 텍스트 Transformer 리사이즈가 끝나면 `boxWidth`를 저장한다.

**Step 3: Render aligned text inside box**

- `Konva.Text`에 `width`, `offsetX`, `align`를 박스 기준으로 연결한다.

### Task 3: 검증

**Files:**
- Modify: `tests/canvas-keyboard-shortcuts.test.mjs`

**Step 1: Run targeted tests**

Run: `node --experimental-strip-types --test tests/canvas-keyboard-shortcuts.test.mjs`

**Step 2: Run build**

Run: `npm run build`

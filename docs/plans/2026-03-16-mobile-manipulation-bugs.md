# Mobile Manipulation Bugs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일에서 이미지 확대/축소, 텍스트 크기 조절, 스티커 이동/크기/회전이 안정적으로 동작하게 만든다.

**Architecture:** `App`의 선택 상태를 단일 기준으로 `CanvasStage`에 전달하고, `CanvasStage`는 모바일 터치 시작과 transform 종료 시점에 실제 표시 결과를 상태로 되돌린다. 텍스트와 스티커는 transform 후 Konva 노드 scale을 리셋해 다음 조작의 기준값이 누적되지 않게 한다.

**Tech Stack:** React 18, TypeScript, Konva, react-konva, node:test

---

### Task 1: 회귀 테스트 추가

**Files:**
- Modify: `tests/mobile-touch-interactions.test.mjs`
- Modify: `tests/text-rotation-persistence.test.mjs`
- Modify: `tests/canvas-keyboard-shortcuts.test.mjs`

**Step 1: Write the failing tests**

- `App.tsx`가 `selection={editorState.selection}`을 전달하는지 검증한다.
- `CanvasStage.tsx`가 모바일 이미지 `onTouchStart`에서 즉시 `selectImage(...)`를 호출하고, 두 손가락일 때만 pinch 상태를 시작하는지 검증한다.
- 텍스트/스티커 `onTransformEnd`가 다음 조작 전에 `node.scaleX(1)`, `node.scaleY(1)`을 호출하는지 검증한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/mobile-touch-interactions.test.mjs tests/text-rotation-persistence.test.mjs tests/canvas-keyboard-shortcuts.test.mjs`

Expected: 새 패턴을 찾지 못해 FAIL

### Task 2: 선택 상태와 모바일 이미지 조작 수정

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/canvas/CanvasStage.tsx`

**Step 1: Write minimal implementation**

- 이미지 업로드 직후 `selection`과 `selectedSlot`을 새 이미지로 맞춘다.
- `CanvasStage`에는 `editorState.selection`을 전달한다.
- 모바일 이미지 `onTouchStart`는 먼저 이미지를 선택하고, 터치가 2개 이상일 때만 pinch 상태를 시작한다.

**Step 2: Run related tests**

Run: `node --experimental-strip-types --test tests/mobile-touch-interactions.test.mjs`

Expected: PASS

### Task 3: 텍스트/스티커 transform 저장 안정화

**Files:**
- Modify: `src/canvas/CanvasStage.tsx`
- Test: `tests/text-rotation-persistence.test.mjs`
- Test: `tests/canvas-keyboard-shortcuts.test.mjs`

**Step 1: Write minimal implementation**

- 텍스트 transform 종료 시 scale 값을 안전한 단일 기준으로 계산하고 `boxWidth`, `fontSize`, `rotation`, `x`, `y`를 저장한다.
- 텍스트와 스티커 모두 상태 저장 직후 Konva 노드 scale을 `1`로 리셋한다.
- 스티커 drag는 모바일에서도 위치가 즉시 상태에 반영되도록 `onDragMove`도 함께 사용한다.

**Step 2: Run related tests**

Run: `node --experimental-strip-types --test tests/text-rotation-persistence.test.mjs tests/canvas-keyboard-shortcuts.test.mjs`

Expected: PASS

### Task 4: 전체 검증

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/canvas/CanvasStage.tsx`
- Modify: `tests/mobile-touch-interactions.test.mjs`
- Modify: `tests/text-rotation-persistence.test.mjs`
- Modify: `tests/canvas-keyboard-shortcuts.test.mjs`

**Step 1: Run lint**

Run: `npm run lint -- src/App.tsx src/canvas/CanvasStage.tsx tests/mobile-touch-interactions.test.mjs tests/text-rotation-persistence.test.mjs tests/canvas-keyboard-shortcuts.test.mjs`

Expected: PASS

**Step 2: Run regression tests**

Run: `node --experimental-strip-types --test tests/mobile-touch-interactions.test.mjs tests/text-rotation-persistence.test.mjs tests/canvas-keyboard-shortcuts.test.mjs`

Expected: PASS

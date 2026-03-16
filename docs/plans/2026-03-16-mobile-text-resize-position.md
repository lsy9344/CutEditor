# Mobile Text Resize And Position Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일에서 텍스트 리사이즈 시 글자 크기가 실제로 함께 커지도록 고치고, 4컷 계열 프레임의 기본 텍스트 삽입 위치를 2컷 세로와 동일하게 맞춘다.

**Architecture:** 텍스트 transform 종료 시 저장할 `boxWidth`와 `fontSize` 계산을 작은 유틸 함수로 분리해 반복 조작 기준값을 안정화한다. 프레임별 기본 텍스트 위치도 별도 유틸로 분리해 `SidebarRight`의 분기 누락 없이 4컷 세로 계열을 하나의 규칙으로 관리한다.

**Tech Stack:** React, TypeScript, react-konva, Node test runner

---

### Task 1: 텍스트 transform 계산 회귀 테스트

**Files:**
- Create: `tests/text-transform-sizing.test.mjs`
- Create: `src/canvas/textTransform.ts`

**Step 1: Write the failing test**

테스트로 다음 상황을 재현한다.
- 텍스트 박스 폭만 커진 경우에도 `fontSize`가 함께 커져야 한다.
- 연속 리사이즈 시 이전 상태를 기준으로 다시 계산되어야 한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/text-transform-sizing.test.mjs`

Expected: 새 유틸이 없어서 실패하거나, 기대한 크기 계산과 다르게 실패

**Step 3: Write minimal implementation**

`src/canvas/textTransform.ts`에 텍스트 transform 결과를 계산하는 순수 함수를 만든다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/text-transform-sizing.test.mjs`

Expected: PASS

### Task 2: 4컷 기본 위치 회귀 테스트

**Files:**
- Create: `tests/default-text-position.test.mjs`
- Create: `src/ui/defaultTextPosition.ts`

**Step 1: Write the failing test**

테스트로 다음 규칙을 고정한다.
- `2v`와 `4v`, `4`, `4v_1`~`4v_6`은 같은 기본 텍스트 위치를 사용한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/default-text-position.test.mjs`

Expected: 분리된 유틸이 없거나, 4컷 세로 파생 프레임이 빠져 실패

**Step 3: Write minimal implementation**

`src/ui/defaultTextPosition.ts`에 프레임 타입별 기본 좌표 함수를 추가한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/default-text-position.test.mjs`

Expected: PASS

### Task 3: 앱 연결

**Files:**
- Modify: `src/canvas/CanvasStage.tsx`
- Modify: `src/ui/SidebarRight.tsx`
- Test: `tests/mobile-canvas-transform-regressions.test.mjs`

**Step 1: Write the failing test**

기존 모바일 회귀 테스트에 새 계산 유틸과 기본 위치 유틸 사용 여부를 추가한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/mobile-canvas-transform-regressions.test.mjs tests/text-transform-sizing.test.mjs tests/default-text-position.test.mjs`

Expected: 새 유틸 연결 전이라 실패

**Step 3: Write minimal implementation**

- `CanvasStage`가 텍스트 transform 종료 시 공통 계산 유틸을 사용한다.
- `SidebarRight`가 기본 위치 유틸을 사용한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/mobile-canvas-transform-regressions.test.mjs tests/text-transform-sizing.test.mjs tests/default-text-position.test.mjs`

Expected: PASS

### Task 4: 최종 검증

**Files:**
- Modify: `src/canvas/CanvasStage.tsx`
- Modify: `src/ui/SidebarRight.tsx`
- Test: `tests/text-rotation-persistence.test.mjs`

**Step 1: Run targeted verification**

Run: `node --experimental-strip-types --test tests/mobile-canvas-transform-regressions.test.mjs tests/text-transform-sizing.test.mjs tests/default-text-position.test.mjs tests/text-rotation-persistence.test.mjs`

Expected: PASS

**Step 2: Run lint for touched files**

Run: `npm run lint -- src/canvas/CanvasStage.tsx src/canvas/textTransform.ts src/ui/SidebarRight.tsx src/ui/defaultTextPosition.ts tests/mobile-canvas-transform-regressions.test.mjs tests/text-transform-sizing.test.mjs tests/default-text-position.test.mjs tests/text-rotation-persistence.test.mjs`

Expected: 0 errors

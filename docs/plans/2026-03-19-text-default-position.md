# [Text Default Position] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `3컷`, `6컷`, `8컷`, `9컷`에서 새 텍스트를 삽입할 때, 각 컷의 새 이름(`*_1`) 기준 시작 위치로 배치되게 만든다.

**Architecture:** 텍스트 삽입 시점에 `selectedFrame`을 기준으로 기본 좌표를 조회하는 현재 구조를 그대로 유지한다. 프레임별 기본 좌표 테이블만 확장해서, 새 프레임 이름인 `2v_1`, `3v_1`, `6v_1`, `6v_2`, `8v_1`, `8v_2`, `8v_3`, `9v_1`이 각자 기본 위치를 반환하도록 맞춘다.

**Tech Stack:** TypeScript, Node test, React

---

### Task 1: Update default text position mapping

**Files:**
- Modify: `src/ui/defaultTextPosition.ts`
- Test: `tests/default-text-position.test.mjs`

**Step 1: Write the failing test**

Add assertions that the new `*_1` frame types return the expected default coordinates.

**Step 2: Run test to verify it fails**

Run: `node --test tests/default-text-position.test.mjs`
Expected: FAIL because the new frame types still fall back to the old default.

**Step 3: Write minimal implementation**

Update the position map so the new `*_1` frame types return the intended default coordinates.

**Step 4: Run test to verify it passes**

Run: `node --test tests/default-text-position.test.mjs`
Expected: PASS.

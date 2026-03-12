# Sticker Sidebar Scroll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 오른쪽 사이드바의 스티커 카테고리/목록이 창 높이를 밀어 올리지 않고, 최대 높이를 넘기면 내부 스크롤로 전환되게 만든다.

**Architecture:** `SidebarRight`의 스티커 탭을 상단 고정 영역과 스크롤 영역으로 나눈다. 카테고리 목록과 스티커 그리드에 `flex: 1`, `minHeight: 0`, `overflowY: auto`를 보장해서 부모 카드 높이 안에서만 스크롤되도록 맞춘다.

**Tech Stack:** React, TypeScript, node:test, ESLint

---

### Task 1: 스크롤 회귀 테스트 추가

**Files:**
- Modify: `tests/sticker-sidebar-layout.test.mjs`
- Modify: `src/ui/SidebarRight.tsx`

**Step 1: Write the failing test**

스티커 탭의 카테고리 목록 컨테이너와 스티커 그리드 컨테이너가 모두 `overflowY: "auto"`, `flex: 1`, `minHeight: 0`을 가지는지 확인하는 문자열 기반 회귀 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/sticker-sidebar-layout.test.mjs`
Expected: FAIL because the category list container does not yet guarantee the final scroll layout.

**Step 3: Write minimal implementation**

`SidebarRight`에 스크롤 전용 style 객체를 추가하고, 카테고리 목록과 스티커 그리드가 동일한 스크롤 제약을 공유하게 수정한다.

**Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/sticker-sidebar-layout.test.mjs`
Expected: PASS

### Task 2: 전체 검증

**Files:**
- Modify: `src/ui/SidebarRight.tsx`
- Modify: `tests/sticker-sidebar-layout.test.mjs`

**Step 1: Run focused test**

Run: `node --experimental-strip-types --test tests/sticker-sidebar-layout.test.mjs`
Expected: PASS

**Step 2: Run lint**

Run: `npx eslint src/ui/SidebarRight.tsx tests/sticker-sidebar-layout.test.mjs`
Expected: exit code 0

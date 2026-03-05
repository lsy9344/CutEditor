# CutEditor 프레임 갤러리 전면 개편 작업지시서 (Work Directive)

> **기준 문서:** [refactoring_history.md](../refactoring_history.md)
> **작성 목적:** UI/UX 리팩토링 상세 내역을 바탕으로 실제 구현하기 위한 구체적 Action Item 및 가이드라인 제시

---

## 📅 Phase 1: 캔버스 모드 전환 기능 (핵심 아키텍처)

### 1-1. 전역 상태 (`canvasMode`) 추가
- **대상 파일:** `src/App.tsx`
- **구체적 작업 내용:**
  - `const [canvasMode, setCanvasMode] = useState<'gallery' | 'editor'>('gallery');` 상태 정의
  - 프레임 미선택 초기 상태는 항상 `'gallery'`로 시작.

### 1-2. `FrameGallery.tsx` 컴포넌트 신규 생성
- **대상 파일:** `src/canvas/FrameGallery.tsx` [NEW]
- **구체적 작업 내용:**
  - 단일 책임 원칙(SRP)에 따라 1,520줄에 달하는 `CanvasStage.tsx`를 건드리지 않고, 순수 React DOM으로 구성된 갤러리 뷰 컴포넌트를 분리하여 개발.
  - **Props:** `selectedCategory`, `options` (해당 카테고리의 프레임 목록), `onSelectFrame`
  - 카테고리에 속한 프레임들을 매핑하여 `<div className="frame-gallery-card">` 렌더링.

### 1-3. 캔버스 영역 조건부 렌더링 적용
- **대상 파일:** `src/App.tsx`
- **구체적 작업 내용:**
  - 레이아웃 중앙 영역에 조건부 렌더링 로직 추가.
  ```tsx
  {canvasMode === 'gallery' ? (
    <FrameGallery 
      selectedCategory={selectedCategory} 
      options={availableOptions} 
      onSelectFrame={handleFrameSelect} 
    />
  ) : (
    <CanvasStage ... />
  )}
  ```

### 1-4. 갤러리 빈 상태 (Empty State) 온보딩 디자인
- **대상 파일:** `src/canvas/FrameGallery.tsx`
- **구체적 작업 내용:**
  - 카테고리가 미선택(`selectedCategory === null`) 상태일 때의 UI 구현.
  - 프레임 선택을 유도하는 직관적인 아이콘/일러스트와 함께 브루탈리즘 타이포그래피로 "왼쪽에서 원하는 컷 수를 먼저 선택해 주세요!" 큰 텍스트 배치.

### 1-5. 단일 옵션 카테고리 자동 진입 (`autoSelect`)
- **대상 파일:** `src/ui/SidebarLeft.tsx` 또는 `src/App.tsx` (카테고리 선택 핸들러)
- **구체적 작업 내용:**
  - 4컷/6컷/9컷 등 하위 옵션이 1개(`options.length === 1`)인 카테고리 클릭 시:
    - 갤러리 단계를 거치지 않고 바로 해당 프레임 선택(`setSelectedFrame(options[0].value)` 등).
    - `setCanvasMode('editor')` 즉시 호출.
    - 향후 옵션이 추가될 것을 대비해 갤러리 컴포넌트 로직은 그대로 유지.

---

## 🎨 Phase 2: 좌측 사이드바 개편

### 2-1. `FrameOption` 데이터 구조 보강 
- **대상 파일:** `src/types/frame.ts` & `src/ui/SidebarLeft.tsx`
- **구체적 작업 내용:**
  - `FrameOption` 인터페이스에 하위 속성 보강 (갤러리 및 모바일 아이콘 맵핑용):
    ```typescript
    export type FrameOption = {
      value: FrameType;
      label: string;
      image: string; // 기존 팝오버용 이미지 파일명 (갤러리에서도 재활용)
      orientation?: 'vertical' | 'horizontal'; // 방향성 아이콘 노출용
      description?: string; // 부가 설명 텍스트
    }
    ```

### 2-2. 2Depth 하위 프레임 버튼 목록 디자인 변경
- **대상 파일:** `src/ui/SidebarLeft.tsx`
- **구체적 작업 내용:**
  - 기존 텍스트 + 데스크탑 호버 팝오버 방식 완전히 제거 (미리보기는 갤러리가 전담).
  - 디자인 형태를 "라벨 텍스트 + ↕️(세로) 또는 ↔️(가로) 아이콘"의 간결한 소형 뱃지/리스트 형태로 변경.
  - 1컷 카테고리의 경우 `description` 필드를 활용해 "사진에 직접 텍스트 올리기" vs "프레임 안에 사진 넣기"의 서브텍스트 출력.

### 2-3. '편집 중' 뱃지 및 '갤러리로 돌아가기' 인터페이스
- **대상 파일:** `src/ui/SidebarLeft.tsx`
- **구체적 작업 내용:**
  - **편집 중 뱃지:** `canvasMode === 'editor'`일 때 현재 활성화된 프레임 라벨 옆에 `[✏️ 편집 중]` 형태의 브루탈리즘 스타일 뱃지 컴포넌트 노출.
  - **돌아가기 버튼:** 2Depth 프레임 리스트 상단이나 하단에 `<button>← 다른 프레임 갤러리 보기</button>` 형태의 버튼 추가. 클릭 시 `setCanvasMode('gallery')` 트리거.

### 2-4. 프레임 전환 시 컨텍스트 보존 로직 및 경고창
- **대상 파일:** `src/App.tsx` (`handleFrameSelect` 및 돌아가기 핸들러)
- **구체적 작업 내용:**
  - 기존 프레임 변경 시 무조건 상태를 초기화하던 로직(reset) 수정.
  - 에디터 모드에서 "다른 프레임 카드/버튼" 클릭 시 데이터 존재 여부 검사 로직 추가:
    - `texts.length > 0 || stickers.length > 0 || Object.values(images).some(img => img !== null)` 일 경우.
    - `window.confirm("프레임을 변경하면 디자인 캔버스의 모든 편집 내용이 초기화됩니다. 변경하시겠습니까?")` 경고 표시. 확인 시에만 리셋 로직 실행.
  - 현재 보고 있는 '동일한 프레임'을 다시 누를 때는 경고 및 초기화를 생략(`return`).

---

## 📱 Phase 3 & 5: 반응형 갤러리 디자인 및 모바일 대응

### 3-1. 갤러리 카드 `.frame-gallery-card` 디자인 시스템 구현
- **대상 파일:** `src/components/components.css`
- **구체적 작업 내용:**
  - 네오 브루탈리즘 원칙의 UI 스타일 작성.
  - `.frame-gallery-card`: `border: var(--border-width) solid #000; box-shadow: var(--shadow-base); background-color: var(--linear-neutral-600);`
  - `.frame-gallery-card:hover`: `transform: translate(-2px, -2px); box-shadow: var(--shadow-hover);`
  - `.frame-gallery-card:active`: `transform: translate(2px, 2px); box-shadow: var(--shadow-active);`
  - React 컴포넌트 진입 시 부드러운 시작 위해 `.linear-fade-in` 유틸리티 클래스 적용.

### 3-2. `.linear-card` 글로벌 Hover 부작용 제거
- **대상 파일:** `src/components/components.css` & `src/ui/SidebarLeft.tsx`
- **구체적 작업 내용:**
  - 사이드바 전체 영역이 마우스 오버 시 떠오르는 의도치 않은 현상(`.linear-card:hover`) 방지.
  - 사이드바 등 고정 컨테이너에는 hover 효과가 없는 `.linear-card--static` 등의 변형 클래스 적용해 UI 튀는 현상 해결.

### 3-3. 프레임 비율별 데스크탑/모바일 그리드 대응 (반응형)
- **대상 파일:** `src/canvas/FrameGallery.tsx` 및 `components.css`
- **구체적 작업 내용:**
  - **데스크탑 (`> 768px`):** 향후 여러 개의 프레임이 추가되더라도 일관된 UI를 유지할 수 있도록, 개별 프레임의 비율이나 방향에 따라 크기가 달라지지 않는 고정 3열 그리드(`display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;`)로 구성. 각 카드는 동일한 정방형/직사각형 규격을 가지고 내부에 이미지가 핏(`object-fit: contain`)되도록 스타일링.
  - **모바일 (`< 768px`):** 
    - 갤러리가 너무 길어지면 하단 에디터 툴(SidebarRight)이 보이지 않는 모바일 레이아웃 이슈 해결.
    - 갤러리 컨테이너에 `max-height: 60vh; overflow-y: auto;` 적용.
    - 좁은 화면에서도 카드가 잘리지 않도록 2컬럼 그리드 락 (`grid-template-columns: 1fr 1fr;`) 적용, 이미지는 `object-fit: contain`으로 비율 유지.
    - 데스크탑 전용 Hover 액션은 모바일에서 트리거되지 않게 터치 즉시 선택 방식(`onClick` 및 `:active` css) 우대.

---

## 🖼️ Phase 4: 에셋 관리 및 최적화

### 4-1. 기존 popover 이미지의 재활용
- **대상 파일:** `src/canvas/FrameGallery.tsx`
- **구체적 작업 내용:**
  - 추가적인 비용(디자인/서버용량) 없이 기존 `/public/popover/*.png` 경로의 이미지들을 갤러리 카드 썸네일로 활용 (`<img src={`/popover/${option.image}`} />`).
  - `FrameOption` 타입에 `previewImage` 필드를 별도로 파지 않음(생략).

### 4-2. 이미지 Lazy Loading과 스켈레톤 UI
- **대상 파일:** `src/canvas/FrameGallery.tsx`
- **구체적 작업 내용:**
  - 갤러리 내 모든 `<img>` 태그에 `loading="lazy"` 속성 추가.
  - 이미지 패칭 속도 개선을 위해 `onLoad` 이벤트를 이용, 로딩 전까지 회색 네오 브루탈리즘 테두리 안에서 Pulse(깜빡이는) 애니메이션 스켈레톤 배경 또는 CSS 그라데이션 노출 구현.

---

## 🛠️ Phase 6: 레거시 코드 호환 및 클렌징

### 6-1. 호환 별칭 매핑 로직
- **대상 파일:** `src/App.tsx` (`handleFrameSelect` 메서드 또는 초기화 로직)
- **구체적 작업 내용:**
  - 레거시 호환 및 외부 URL 유입을 대비해 프레임 타입 값이 `"2"`, `"4"`, `"6"`, `"9"` 로 유입되는 경우 리듀서나 맵 컨버터를 통해 `"2v"`, `"4v"`, `"6v"`, `"9v"` 정규 타입으로 안전하게 치환하는 방어 로직 추가.
  - UI 렌더링 리스트 데이터 구조 (`FRAME_OPTIONS_BY_CATEGORY`) 에서는 혼동 방지를 위해 이런 별칭(aliases) 레코드를 명시적으로 제외.

### 6-2. 디자인 관련 CSS 변수명 정합성 점검
- **대상 파일:** `src/components/components.css` 및 기타 CSS/tsx 적용 영역
- **구체적 작업 내용:**
  - 문서상 언급된 `var(--radius-base)` 관련 토큰이 올바르게 네오브루탈리즘 코어 테마 네임스페이스인 `var(--linear-radius-base)`(또는 `0px` 값 사용 방식)로 일치하게 작성되어 있는지 검사 및 수정.

---

## 💡 개발 시 권장 작업 순서 (Task Priority)

1. **상태 및 타입 통합 설계:** `App.tsx`의 `canvasMode` state 설계, `src/types/frame.ts` 속성 추가.
2. **신규 갤러리 컴포넌트 도출:** `FrameGallery.tsx` 기본 스캐폴딩 및 `App.tsx` 조건 분기 연결.
3. **사이드바 UI 뎁스 개편 및 연동:** `SidebarLeft.tsx` 2Depth 리스트 렌더링 변경 및 `autoSelect`, 에디터 모드 연동 작업.
4. **비즈니스 로직 방어막 추가:** 확인(Confirm) 다이얼로그, 뱃지 표기, 돌아가기(`<-`) 기능 구현.
5. **CSS 시각적 완성도 및 반응형 처리:** 데스크탑/모바일 그리드 맞춤 조정, CSS 토큰 일치화 픽스, 이미지 에셋 최적화 적용.

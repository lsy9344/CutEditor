# Components

## Layout
- DesktopNavigationRail: 데스크톱 프레임/글씨/스티커/저장 네비게이션
- SidebarLeft: 프레임 카테고리/스타일 선택 패널
- CanvasStage: 슬롯/가이드/오버레이 렌더
- EditorPanel: 텍스트/스티커 편집 패널
- WizardFooter: 이전/다음/내보내기

## CanvasStage Props/Events (예시)
- props: { template, slots[], guides, selection, zoom }
- events: onSelect(objectId), onTransform(change), onDropImage(file, slotId)
- tutorialAnchorRefs?: 튜토리얼 ⑤바닥 얼룩 지우기·⑥사진 색·⑦프레임 색 단계가 가리킬 편집 카드와 그 구획 ref. App이 만들어 TutorialOverlay에 넘기며, 카드 내용과 동작은 바꾸지 않습니다.

컴포넌트를 새로 만들지 말고 /Users/sooyeol/Desktop/Code/cut_editor_250830/src/components/components.css 컴포넌트만 사용하세요.

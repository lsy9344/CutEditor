# Components

## Layout
- SidebarLeft: 템플릿/옵션
- CanvasStage: 슬롯/가이드/오버레이 렌더
- SidebarRight: 선택된 객체 속성(텍스트/이미지 모드)
- WizardFooter: 이전/다음/내보내기

## CanvasStage Props/Events (예시)
- props: { template, slots[], guides, selection, zoom }
- events: onSelect(objectId), onTransform(change), onDropImage(file, slotId)
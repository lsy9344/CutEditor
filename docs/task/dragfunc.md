목표

src/canvas/CanvasStage.tsx에서 슬롯 위에 마우스를 올린 채 마우스 휠을 위/아래 스크롤하면 해당 슬롯의 사진이 줌인/아웃되도록 구현한다.
PC 앱(PySide) 동작과 동등: 휠 이벤트 감지 → delta 해석 → 스케일 업데이트 → 리사이즈/렌더 반영.
새 컴포넌트 생성 금지. 기존 공통 컴포넌트/스타일을 그대로 활용하며 로직만 추가.
범위

캔버스의 슬롯 단위 이미지에 한정된 줌 제어(전체 캔버스 줌 아님).
상태 저장은 슬롯별 스케일(및 선택 시 커서 고정형 줌이 필요하면 오프셋)만 추가.
브라우저 기본 스크롤과 충돌 방지.
UX 규칙

슬롯 위에서만 동작: 슬롯 밖/빈 영역에서는 페이지 스크롤 유지.
휠 위로(=줌인), 휠 아래로(=줌아웃). PySide의 delta 부호 규칙과 동일한 체감.
스케일 범위 클램프: 기본 0.1 ~ 5.0 (프로젝트 요구에 따라 상수화).
기본 중심 기준 줌(간단). 선택적으로 “커서 고정” 줌을 확장 옵션으로 제공.
확대 상태는 슬롯별로 독립(슬롯 A 확대해도 슬롯 B에는 영향 없음).
브라우저 이벤트와 PySide delta 매핑

브라우저 wheel 이벤트: event.deltaY 음수=위로(줌인), 양수=아래로(줌아웃).
PySide QWheelEvent delta의 의미와 동일하게 부호만 맞춰 해석.
트랙패드 등 고해상도 스크롤 대비 가중치 스케일러 필요(예: step = Math.sign(deltaY) * 0.1 또는 지수 스케일).
데이터 모델 변경(상태 설계)

슬롯 단위 스케일 저장:
src/state/ 내 편집 상태 슬라이스에 zoomBySlot: Record<string, number> 추가.
선택적(커서 고정형 줌 사용 시): panBySlot: Record<string, {x: number, y: number}>.
액션
setSlotZoom(slotId: string, scale: number)
선택적: nudgeSlotPan(slotId: string, dx: number, dy: number) 또는 setSlotPan(...)
셀렉터
selectSlotZoom(slotId) / selectSlotPan(slotId)
핸들링 알고리즘

배율 업데이트(중심 기준 줌, 기본안)
현재 배율 s에서 휠 입력에 따라 s' = clamp(s * (1 + k)) 또는 s' = s * (deltaY < 0 ? 1.1 : 0.9)
k는 소규모(예: 0.1). 트랙패드 과민 반응 방지 위해 Math.sign(deltaY) 사용 권장.
커서 고정형 줌(확장안)
transform-origin을 커서 상대 좌표로 설정하거나,
캔버스 좌표계에서 커서 위치 c가 확대 전후 동일한 이미지 좌표를 가리키도록 pan 보정:
이미지 좌표 p = (c - pan) / s
확대 후 pan' = c - p * s'
이 방식은 확대 시 포인터 아래 픽셀이 고정되어 자연스러운 줌 제공.
렌더링 반영

CanvasStage.tsx 슬롯 이미지 래퍼에 스타일 적용:
중심 줌: transform: translate(-50%, -50%) scale(${scale})
커서 고정형: transform-origin을 커서 위치 기준(슬롯 내 로컬 좌표)으로 설정하거나 translate에 pan 보정 포함.
새 컴포넌트 금지: 현 컴포넌트 내 요소에만 핸들러/스타일 추가.
CSS 토큰/공통 클래스는 유지(새 CSS 생성 금지). 필요 시 기존 클래스에 인라인 style로 transform만 덧붙임.
이벤트 처리 구현 포인트

대상 파일: src/canvas/CanvasStage.tsx
각 슬롯 컨테이너에 onWheel 바인딩. 슬롯 식별을 위해 data-slot-id나 이미 존재하는 식별자를 사용.
onMouseEnter/onMouseLeave로 “활성 슬롯 id”를 추적하거나, onWheel에서 이벤트 타깃으로 즉시 추출.
이벤트 처리 흐름:
이벤트 대상이 이미지 슬롯인지 확인(이미지 없으면 리턴).
event.preventDefault() 호출로 페이지 스크롤 방지(슬롯 위에서만).
deltaY를 배율 변경치로 변환 → 현재 배율 가져와서 클램프 후 저장(dispatch).
커서 고정형이면 슬롯 경계 기준 좌표 계산 → pan 보정 계산/저장.
스크롤 버블링 제어:
슬롯에서만 preventDefault. 캔버스 전체에 억지로 passive: false를 전역 적용하지 않도록 주의.
필요 시 슬롯 컨테이너 CSS에 overscroll-behavior: contain; 적용(기존 클래스에 허용되는 범위 내).
변경 파일과 예상 수정 지점

src/canvas/CanvasStage.tsx
슬롯 노드에 onWheel 추가, data-slot-id 보장.
transform 적용을 위한 style 또는 기존 스타일 객체에 배율 주입.
선택: 마우스 위치를 이용한 transform-origin 또는 pan 보정.
src/state/<editorSlice>.ts 또는 동등 위치
zoomBySlot/액션/리듀서/셀렉터 추가.
초기 배율 기본값 1.0.
src/utils/ (선택)
배율 클램프/증감 유틸: applyZoom(current, deltaY, {min, max, step}).
커서 고정형 보정 수식 유틸.
의사 코드(핵심 로직 요약)

슬롯 휠 핸들러
const handleWheel = (e) => {
const slotId = findSlotId(e.target);
if (!hasImage(slotId)) return;
e.preventDefault();
const dir = Math.sign(e.deltaY); // -1=위, +1=아래
const next = clamp(scale * (dir < 0 ? 1.1 : 0.9), MIN, MAX);
dispatch(setSlotZoom(slotId, next));
// 확장: 커서 고정형이면 pan 보정 계산/dispatch
};
성능

배율/팬 상태만 변경 → 리렌더 최소화(슬롯 단위 메모이제이션 권장).
CSS transform 기반 하드웨어 가속 활용으로 성능 확보.
휠 이벤트 스로틀링은 일반적으로 불필요하나, 트랙패드 과도 입력 시 8–16ms 스로틀 고려 가능.
엣지 케이스

이미지 미로딩/없음: 핸들러 조기 반환.
배율 경계 도달: 추가 입력 무시.
매우 큰 캔버스/고해상도 이미지: 커서 고정형 도입 시 pan 범위 클램프 필요(이미지 경계 밖으로 과도 이동 방지).
모바일/터치: 본 스펙에서 제외(향후 핀치 줌 별도).
접근성

키보드 대체 입력(선택): 슬롯 포커스 + +/- 키로 줌인/아웃.
현재 배율은 시각적 피드백 요소가 있다면 aria-live로 노출 고려.
테스트 계획

유닛: 리듀서(줌 클램프, 증감 로직), 유틸 함수 검증(applyZoom).
컴포넌트: 슬롯에 이미지 유무에 따른 동작 분기, 배율 적용 후 style.transform 반영 확인.
수동:
슬롯 위에서 휠 위/아래 → 확대/축소 체감 여부.
슬롯 외부 휠 → 페이지 스크롤 정상.
경계값(최소/최대)에서 더 이상 변화 없음.
다중 슬롯 독립 동작.
선택: 커서 고정형에서 포인터 아래 픽셀 고정 확인.
수용 기준(DoD)

슬롯 위 휠로 이미지 줌 인/아웃이 자연스럽게 동작한다.
슬롯 외부 휠은 페이지 스크롤을 방해하지 않는다.
배율은 슬롯별로 독립 저장/복원된다.
클램프/보정 로직으로 비정상 이동/깜빡임이 없다.
새 컴포넌트/새 CSS 없이 기존 구조/토큰을 사용한다.
pytest -q 영향 없음, 웹 린트/타입 체크 통과.
작업 체크리스트

상태: zoomBySlot/액션/셀렉터 추가.
CanvasStage.tsx: 슬롯에 onWheel 바인딩 및 배율 적용.
기본 배율/경계/스텝 상수화.
선택: 커서 고정형 pan 보정 구현.
수동/유닛 테스트로 동작 확인.
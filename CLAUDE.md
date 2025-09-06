# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CutEditor Project - Web-based Cut Editor

**한국어로 대화하세요.** 

이 프로젝트는 2/4/6/9칸 이미지 배치, 프레임 오버레이, 텍스트 합성, 고해상도 내보내기 기능을 제공하는 웹 기반 컷에디터입니다.

## 개발 명령어

### 린트 및 코드 품질
```bash
npm run lint          # ESLint 검사
npm run lint:fix      # ESLint 자동 수정
```

### Python 코어 유틸리티 (editor_core/)
```bash
python -m pytest editor_core/tests/    # 파이썬 테스트 실행
black editor_core/                      # 파이썬 포매팅
flake8 editor_core/                     # 파이썬 린트
```

## 🚨 코드 품질 필수사항
**모든 hook 이슈는 BLOCKING - 모든 것이 ✅ GREEN이어야 함!**
- 에러 없음, 포매팅 이슈 없음, 린트 문제 없음
- 이는 제안이 아니라 요구사항입니다. 계속하기 전에 모든 문제를 해결하세요.

## 개발 워크플로우: Research → Plan → Implement

**바로 코딩하지 마세요!** 항상 이 순서를 따르세요:
1. **Research**: 코드베이스 탐색, 기존 패턴 이해
2. **Plan**: 상세한 구현 계획 수립 및 검증
3. **Implement**: 검증 체크포인트와 함께 실행

기능 구현 요청 시 항상 이렇게 시작하세요: "코드베이스를 조사하고 구현 전에 계획을 세우겠습니다."

복잡한 아키텍처 결정이나 어려운 문제의 경우 **"ultrathink"**를 사용하여 최대 추론 능력을 활용하세요.

## 프로젝트 아키텍처

### 기술 스택
- **Frontend**: React + Vite
- **Canvas Rendering**: Fabric.js 또는 Konva.js
- **High-res Export**: OffscreenCanvas + Web Workers
- **State Management**: 글로벌 상태 (atom/store)
- **Python Core**: 유닛 변환, 템플릿 검증 유틸리티

### 핵심 모듈 구조
```
src/
├── state/          # 글로벌 상태 관리 (TypeScript)
├── templates/      # 템플릿 로더/런타임 검증
├── canvas/         # 캔버스 렌더러 (스테이지/트랜스폼)
├── export/         # 워커 메시지/타일러
├── workers/        # OffscreenCanvas 렌더 워커
├── ui/            # 좌/우 사이드바, 푸터
└── utils/         # 유틸리티 (단위 변환 등)

editor_core/       # Python 코어 유틸 및 테스트
├── units.py       # mm↔px 변환 함수
├── template_validator.py  # JSON 템플릿 검증
└── template_loader.py     # JSON 로드/검증 래퍼
```

### 데이터 흐름
사용자 입력 → 상태 업데이트 → 캔버스 객체 반영 → (내보내기 시) 렌더 워커 호출 → Blob 다운로드

## 구현 표준

### 코드가 완성되는 조건:
- ✅ 모든 린터가 문제없이 통과
- ✅ 모든 테스트가 통과
- ✅ 기능이 end-to-end로 작동
- ✅ 구형 코드 삭제 완료

### 코딩 표준:
- **의미 있는 이름**: `userID` (O), `id` (X)
- **조기 반환**으로 중첩 줄이기
- **구체적인 타입**들
- **간단한 에러 처리**
- **이전 코드 삭제** 시 교체

## 문제 해결 프로토콜

막히거나 혼란스러울 때:
1. **멈춤** - 복잡한 해결책으로 빠지지 마세요
2. **위임** - 병렬 조사를 위한 에이전트 생성 고려
3. **Ultrathink** - "이 도전에 대해 ultrathink가 필요합니다"
4. **한 걸음 뒤로** - 요구사항 재검토
5. **단순화** - 간단한 해결책이 보통 맞습니다
6. **질문** - "A 접근법 vs B 접근법이 있습니다. 어떤 것을 선호하시나요?"

더 나은 접근 방식에 대한 인사이트는 소중합니다 - 언제든 문의하세요!

## 특별 지시사항

### Hook 실패는 BLOCKING
**hook가 문제를 보고하면 (종료 코드 2) 반드시:**
1. **즉시 중단** - 다른 작업 계속하지 말 것
2. **모든 문제 수정** - 모든 ❌를 ✅로 만들 때까지
3. **수정 검증** - 실패한 명령을 다시 실행해서 확인
4. **원래 작업 계속** - 중단 전 작업으로 돌아가기

### 작업 메모리 관리
컨텍스트가 길어질 때:
- 이 CLAUDE.md 파일을 다시 읽기
- PROGRESS.md 파일에 진행 상황 요약
- 주요 변경 전 현재 상태 문서화

### 의사소통 프로토콜
진행 상황 업데이트:
```
✓ 인증 구현 완료 (모든 테스트 통과)
✓ 속도 제한 추가
✗ 토큰 만료 문제 발견 - 조사 중
```

/Users/sooyeol/Desktop/Code/cut_editor_250830/src/components/components.css 만들어둔 공통 컴포넌트를 사용해서 구현하고 새로 컴포넌트를 만들지 마세요.

**알림**: 이 파일을 30분 이상 참조하지 않았다면 다시 읽어보세요!
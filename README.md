# CutEditor

웹 기반 컷에디터 - 2/4/6/9칸 이미지 배치, 프레임 오버레이, 텍스트 합성, 고해상도 내보내기 기능을 제공하는 클라이언트 사이드 웹 애플리케이션

## 🎯 프로젝트 개요

기존 PySide2(OpenCV/PIL) 기반 컷에디터를 **브라우저에서 누구나 접속해 사용할 수 있는 웹 서비스**로 재구성합니다.

### 주요 기능
- **레이아웃**: 2/4/6/9컷 × 가로/세로 템플릿 시스템
- **이미지 조작**: 드래그 이동, 확대/축소, 스케일 조정
- **프레임 오버레이**: PNG 오버레이를 최상단에 합성
- **텍스트 도구**: 폰트, 크기, 기울기, 정렬 등 다양한 텍스트 옵션
- **고해상도 내보내기**: 600 DPI 기준 고품질 이미지 생성
- **완전 클라이언트 사이드**: 서버 저장 없이 로컬에서 모든 처리

## 🚀 기술 스택

- **프론트엔드**: React + Vite 또는 Next.js
- **렌더링**: Fabric.js 또는 Konva.js
- **이미지 처리**: Canvas API, WebGL 가속
- **폰트**: Google Fonts (Noto Sans KR 등)
- **배포**: 정적 호스팅 (Vercel/Netlify/Cloudflare Pages)

## 📁 프로젝트 구조

```
CutEditor/
├── docs/                    # 프로젝트 문서
│   ├── ARCHITECTURE.md     # 아키텍처 설계
│   ├── COMPONENTS.md       # 컴포넌트 구조
│   ├── RENDERING_PIPELINE.md # 렌더링 파이프라인
│   └── STATE_MODEL.md      # 상태 관리 모델
├── original_source/         # 기존 소스 코드
├── prompts/                 # 개발 프롬프트
├── public/                  # 정적 파일
│   └── templates/          # 레이아웃 템플릿
└── PRD.md                  # 프로젝트 요구사항 문서
```

## 🎨 사용 시나리오

1. **템플릿 선택**: 2/4/6/9컷, 가로/세로 레이아웃 선택
2. **이미지 업로드**: 여러 장의 사진을 일괄 업로드
3. **자동 배치**: 업로드된 사진을 슬롯에 자동 배치
4. **편집**: 이미지 위치, 크기, 텍스트 등 세부 조정
5. **내보내기**: 고해상도 PNG 이미지로 저장

## 🔧 설치 및 실행

### 개발 환경 설정
```bash
# 저장소 클론
git clone https://github.com/lsy9344/CutEditor.git
cd CutEditor

# 의존성 설치 (프로젝트 설정 후)
npm install

# 개발 서버 실행
npm run dev
```

## 📋 개발 계획

### MVP (최소 기능 제품)
- [ ] 레이아웃 템플릿 시스템
- [ ] 클라이언트 전용 합성 파이프라인
- [ ] 이미지 조작 기능
- [ ] 텍스트 도구
- [ ] 가이드 및 스냅 기능
- [ ] 고해상도 내보내기

### Post-MVP
- [ ] 히스토리 (Undo/Redo)
- [ ] 그룹 복제/정렬
- [ ] 품질 보정
- [ ] 템플릿 관리자

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 새로운 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 [Issues](https://github.com/lsy9344/CutEditor/issues)를 통해 연락해 주세요.

---

**CutEditor** - 웹에서 만나는 전문적인 컷에디터 🎨✨

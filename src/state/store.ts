// 전역 상태 저장소 스켈레톤 (실제 구현은 Valtio/Zustand/Recoil 등으로 대체 가능)
// 목적: 컴포넌트 간 공유 상태 인터페이스를 명시하고 초기 상태를 제공

import type { Template } from "./types";
import type { FrameType, UserImage } from "../types/frame";

export type EditorState = {
  template: Template | null;
  selection: string | null; // 선택된 객체 id
  zoom: number; // 0.1 ~ 4.0
  selectedFrame: FrameType | null; // 선택된 프레임
  userImages: UserImage[]; // 업로드된 이미지들
  frameColor: string; // 프레임 색상
};

export const createInitialState = (): EditorState => ({
  template: null,
  selection: null,
  zoom: 1,
  selectedFrame: null,
  userImages: [],
  frameColor: "#ffffff",
});

// 임시 이벤트 훅/콜백 시그니처 (UI에서 주입)
export type EditorEvents = {
  onSelect?: (id: string | null) => void;
  onZoom?: (zoom: number) => void;
};


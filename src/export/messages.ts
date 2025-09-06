// 워커 메시지 프로토콜 (docs/RENDERING_PIPELINE.md 반영)

import type { Template } from "../state/types";

export type RenderIn = {
  type: "render";
  template: Template;
  slots: unknown[]; // TODO: 배치된 이미지 메타
  texts: unknown[]; // TODO: 텍스트 메타
};

export type ProgressOut = {
  type: "progress";
  ratio: number; // 0~1
};

export type DoneOut = {
  type: "done";
  blobUrl: string;
};

export type ErrorOut = {
  type: "error";
  message: string;
};

export type WorkerIn = RenderIn;
export type WorkerOut = ProgressOut | DoneOut | ErrorOut;


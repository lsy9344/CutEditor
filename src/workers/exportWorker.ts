// 오프스크린 캔버스 기반 렌더 워커(스켈레톤)
// 실제 렌더링은 Canvas 2D/WebGL, 이미지/텍스트 합성, 타일 병합 로직 추가 필요

import type { WorkerIn, WorkerOut } from "../export/messages";

declare const self: Worker;

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type !== "render") return;
  try {
    // TODO: 템플릿 기반 합성 → Blob 생성
    // 데모용: 진행도 100% 후, 빈 Blob 반환
    const progress: WorkerOut = { type: "progress", ratio: 1 };
    self.postMessage(progress);
    const blob = new Blob(["demo"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const done: WorkerOut = { type: "done", blobUrl: url };
    self.postMessage(done);
  } catch (e) {
    const err: WorkerOut = {
      type: "error",
      message: e instanceof Error ? e.message : "unknown",
    };
    self.postMessage(err);
  }
};

export {}; // 모듈로 취급


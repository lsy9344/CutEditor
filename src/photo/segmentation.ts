import type { ImageSegmenter } from "@mediapipe/tasks-vision";

const WASM_BASE_PATH = "/mediapipe/wasm";
const EVERYONE_MODEL_PATH = "/models/selfie_segmenter.tflite";

export type SegmenterLoader<T extends { close(): void }> = {
  get: () => Promise<T>;
  abandonPending: () => void;
};

// 모델 준비 Promise를 하나만 둡니다. 준비가 끝나기 전에 '취소'하면 그 Promise를 버리고,
// 다음 시도는 새 요청으로 시작합니다(설계 6.4).
export function createSegmenterLoader<T extends { close(): void }>(
  create: () => Promise<T>,
): SegmenterLoader<T> {
  let generation = 0; // abandonPending마다 1 올림
  let currentRequest: Promise<T> | null = null;
  let isReady = false;

  const get = (): Promise<T> => {
    if (currentRequest) return currentRequest;
    const requestGeneration = generation;
    currentRequest = create().then(
      (segmenter) => {
        if (requestGeneration !== generation) {
          segmenter.close(); // 버린 요청이 늦게 끝남: 새 요청의 캐시를 덮지 않고 정리
          throw new Error("segmenter request abandoned");
        }
        isReady = true;
        return segmenter;
      },
      (error: unknown) => {
        if (requestGeneration === generation) currentRequest = null; // 지금 요청의 실패만 비움
        throw error;
      },
    );
    return currentRequest;
  };

  const abandonPending = () => {
    if (isReady) return; // 이미 준비된 모델은 그대로 씀
    generation += 1;
    currentRequest = null;
  };

  return { get, abandonPending };
}

async function createEveryoneSegmenter(): Promise<ImageSegmenter> {
  const vision = await import("@mediapipe/tasks-vision"); // 동적 import: 메인 번들에 넣지 않음
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  return vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: EVERYONE_MODEL_PATH, delegate: "CPU" },
    runningMode: "IMAGE",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

const everyoneSegmenter = createSegmenterLoader(createEveryoneSegmenter);

export async function preloadSegmentation(): Promise<void> {
  await everyoneSegmenter.get();
}

// '취소'를 누르면 부릅니다. 아직 준비 중인 모델 요청을 버립니다(Phase 5에서 한 사람 고르기 모델도 함께).
export function abandonPendingSegmenters(): void {
  everyoneSegmenter.abandonPending();
}

export async function segmentEveryone(
  image: HTMLCanvasElement,
  isCancelled: () => boolean,
): Promise<Float32Array | null> {
  const segmenter = await everyoneSegmenter.get();
  if (isCancelled()) return null; // 모델을 기다리는 동안 취소됐으면 추론을 시작하지 않음
  const result = segmenter.segment(image);
  try {
    const masks = result.confidenceMasks;
    const mask = masks ? masks[masks.length - 1] : undefined;
    if (!mask || mask.width !== image.width || mask.height !== image.height) {
      throw new Error("confidence mask mismatch");
    }
    return mask.getAsFloat32Array().slice();
  } finally {
    result.close();
  }
}

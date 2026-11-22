import type { ImageSegmenter, InteractiveSegmenter } from "@mediapipe/tasks-vision";
import type { CutoutSize } from "./cutoutTypes.ts";
import { backgroundToPersonConfidence, getSegmentInputSize, resizeConfidenceBilinear } from "./cutoutMask.ts";

const WASM_BASE_PATH = "/mediapipe/wasm";
const EVERYONE_MODEL_PATH = "/models/selfie_multiclass_256x256.c6748b1253a99067.tflite";
const POINT_MODEL_PATH = "/models/magic_touch.e24338a717c1b7ad.tflite";

export type SegmenterLoader<T extends { close(): void }> = {
  get: () => Promise<T>;
  abandonPending: () => void;
  isReady: () => boolean;
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

  return { get, abandonPending, isReady: () => isReady };
}

// multiclass 모델은 masks[0]이 배경이어야 합니다. 다른 모델이 들어오면 잘못된 채널을 읽지 않게 멈춥니다(설계 4.1).
export function assertBackgroundFirst(labels: string[]): void {
  if (labels[0] !== "background") throw new Error(`segmenter labels must start with background: ${labels.join(",")}`);
}

async function createEveryoneSegmenter(): Promise<ImageSegmenter> {
  const vision = await import("@mediapipe/tasks-vision"); // 동적 import: 메인 번들에 넣지 않음
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  const segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: EVERYONE_MODEL_PATH, delegate: "CPU" },
    runningMode: "IMAGE",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  try {
    assertBackgroundFirst(segmenter.getLabels());
  } catch (error) {
    segmenter.close(); // 실패는 loader가 지금 요청을 비우고 다음 시도를 새 요청으로 만듦
    throw error;
  }
  return segmenter;
}

const everyoneSegmenter = createSegmenterLoader(createEveryoneSegmenter);

async function createPointSegmenter(): Promise<InteractiveSegmenter> {
  const vision = await import("@mediapipe/tasks-vision"); // 동적 import: 메인 번들에 넣지 않음
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE_PATH);
  return vision.InteractiveSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: POINT_MODEL_PATH, delegate: "CPU" },
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

const pointSegmenter = createSegmenterLoader(createPointSegmenter);

export async function preloadSegmentation(): Promise<void> {
  await everyoneSegmenter.get();
}

export async function preloadPointSegmentation(): Promise<void> {
  await pointSegmenter.get();
}

// '취소'를 누르면 부릅니다. 아직 준비 중인 두 모델 요청을 버립니다.
export function abandonPendingSegmenters(): void {
  everyoneSegmenter.abandonPending();
  pointSegmenter.abandonPending();
}

type ReadyLoader = { isReady: () => boolean; get: () => Promise<unknown> };

// 모델이 준비되지 않았을 때만 '준비하는 중'을 켜고, 이 작업이 아직 현재일 때만 끕니다(Codex 필수 4).
// 준비 실패는 그대로 던집니다. 부른 쪽의 catch가 취소 경계 뒤 안내를 정합니다.
export async function waitForModel(loader: ReadyLoader, onPreparingChange: (preparing: boolean) => void, isCancelled: () => boolean): Promise<boolean> {
  if (loader.isReady()) return !isCancelled();
  onPreparingChange(true);
  try {
    await loader.get();
  } finally {
    if (!isCancelled()) onPreparingChange(false);
  }
  return !isCancelled();
}

export function waitForSegmenter(kind: "everyone" | "point", onPreparingChange: (preparing: boolean) => void, isCancelled: () => boolean): Promise<boolean> {
  return waitForModel(kind === "everyone" ? everyoneSegmenter : pointSegmenter, onPreparingChange, isCancelled);
}

const EVERYONE_MASK_COUNT = 6; // multiclass: background, hair, body-skin, face-skin, clothes, others

type ConfidenceMaskLike = { width: number; height: number; getAsFloat32Array(): Float32Array };
type EveryoneResultLike = { confidenceMasks?: ConfidenceMaskLike[]; close(): void };
type EveryoneSegmenterLike<I> = { segment(input: I): EveryoneResultLike };

// 사람 자동 추론의 시험 이음매입니다. 모델과 입력 캔버스는 인자로 받습니다(설계 4.2 '순서' 1~5).
export async function runEveryoneSegmentation<I extends CutoutSize>(
  getSegmenter: () => Promise<EveryoneSegmenterLike<I>>,
  makeInput: () => I, // 모델 준비 뒤, 취소 확인 뒤에만 부름
  workingSize: CutoutSize,
  isCancelled: () => boolean,
): Promise<Float32Array | null> {
  const segmenter = await getSegmenter();
  if (isCancelled()) return null; // 모델을 기다리는 동안 취소됐으면 입력도 추론도 만들지 않음
  const input = makeInput();
  const result = segmenter.segment(input);
  try {
    const masks = result.confidenceMasks;
    if (!masks || masks.length !== EVERYONE_MASK_COUNT) throw new Error("confidence mask count mismatch");
    const background = masks[0]; // masks[1..5]는 읽지 않음
    if (background.width !== input.width || background.height !== input.height) {
      throw new Error("confidence mask mismatch");
    }
    const personConfidence = backgroundToPersonConfidence(background.getAsFloat32Array());
    return resizeConfidenceBilinear(personConfidence, { width: input.width, height: input.height }, workingSize);
  } finally {
    result.close();
  }
}

export async function segmentEveryone(
  image: HTMLCanvasElement,
  isCancelled: () => boolean,
): Promise<Float32Array | null> {
  const getSegmenter = async (): Promise<EveryoneSegmenterLike<HTMLCanvasElement>> => {
    const segmenter = await everyoneSegmenter.get();
    return { segment: (input) => segmenter.segment(input) }; // ImageSegmenter의 겹친 서명을 한 인자 서명으로 맞춤
  };
  return runEveryoneSegmentation(getSegmenter, () => makeSegmentInput(image), { width: image.width, height: image.height }, isCancelled);
}

// 모델 입력: 긴 변 512로 줄인 캔버스. 이미 작으면 작업 캔버스를 그대로 씁니다(설계 4.2).
function makeSegmentInput(image: HTMLCanvasElement): HTMLCanvasElement {
  const size = getSegmentInputSize(image.width, image.height);
  if (size.width === image.width && size.height === image.height) return image;
  const input = document.createElement("canvas");
  input.width = size.width;
  input.height = size.height;
  const context = input.getContext("2d");
  if (!context) throw new Error("segment input canvas context unavailable");
  context.drawImage(image, 0, 0, size.width, size.height);
  return input;
}

export async function segmentAtPoint(
  image: HTMLCanvasElement,
  point: { x: number; y: number },
  isCancelled: () => boolean,
): Promise<Float32Array | null> {
  const segmenter = await pointSegmenter.get();
  if (isCancelled()) return null; // 모델을 기다리는 동안 취소됐으면 추론을 시작하지 않음
  const result = segmenter.segment(image, { keypoint: { x: point.x, y: point.y } });
  try {
    const masks = result.confidenceMasks;
    const mask = masks ? masks[0] : undefined;
    if (!mask || mask.width !== image.width || mask.height !== image.height) {
      throw new Error("confidence mask mismatch");
    }
    return mask.getAsFloat32Array().slice();
  } finally {
    result.close();
  }
}

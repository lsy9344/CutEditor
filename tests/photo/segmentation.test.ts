import test from "node:test";
import assert from "node:assert/strict";

import { backgroundToPersonConfidence, getSegmentInputSize, resizeConfidenceBilinear } from "../../src/photo/cutoutMask.ts";
import type { CutoutSize } from "../../src/photo/cutoutTypes.ts";
import { assertBackgroundFirst, createSegmenterLoader, runEveryoneSegmentation, waitForModel } from "../../src/photo/segmentation.ts";

type FakeMask = { width: number; height: number; getAsFloat32Array(): Float32Array };

// masks[0]만 배경값을 주고, masks[1..5]는 읽히면 예외를 냅니다(설계 4.2: 배경 채널만 읽음).
function createFakeMasks(input: CutoutSize, background: Float32Array, count = 6, firstSize: CutoutSize = input): FakeMask[] {
  const masks: FakeMask[] = [{ width: firstSize.width, height: firstSize.height, getAsFloat32Array: () => background }];
  for (let index = 1; index < count; index += 1) {
    masks.push({
      width: input.width,
      height: input.height,
      getAsFloat32Array: () => {
        throw new Error(`mask ${index} must not be read`);
      },
    });
  }
  return masks;
}

function createFakeModel(makeMasks: (input: CutoutSize) => FakeMask[]) {
  const counts = { segment: 0, close: 0 };
  const model = {
    segment(input: CutoutSize) {
      counts.segment += 1;
      return {
        confidenceMasks: makeMasks(input),
        close() {
          counts.close += 1;
        },
      };
    },
  };
  return { model, counts };
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type FakeModel = { close(): void };

// 실제 createSegmenterLoader에 넣을 가짜 create: 부를 때마다 미뤄진 요청 하나를 만듭니다.
function createFakeCreate() {
  const requests: Deferred<FakeModel>[] = [];
  const create = () => {
    const request = deferred<FakeModel>();
    requests.push(request);
    return request.promise;
  };
  return { create, requests };
}

const createModel = (): FakeModel => ({ close() {} });

function findMismatch(actual: Float32Array, expected: Float32Array): number {
  if (actual.length !== expected.length) return -2;
  for (let index = 0; index < expected.length; index += 1) {
    if (Math.abs(actual[index] - expected[index]) > 1e-6) return index;
  }
  return -1;
}

test("배경이 첫 라벨이 아니면 예외를 낸다", () => {
  assertBackgroundFirst(["background", "hair", "body-skin", "face-skin", "clothes", "others"]);
  assert.throws(() => assertBackgroundFirst(["hair", "background"]));
  assert.throws(() => assertBackgroundFirst([]));
});

test("사람 자동은 배경 채널만 읽어 작업 크기의 새 배열을 돌려준다", async () => {
  for (const working of [
    { width: 300, height: 200 },
    { width: 1000, height: 10 },
    { width: 1, height: 700 },
  ]) {
    const inputSize = getSegmentInputSize(working.width, working.height);
    const background = new Float32Array(inputSize.width * inputSize.height);
    for (let index = 0; index < background.length; index += 1) background[index] = (index % 7) / 6;
    const backgroundBefore = background[0];
    const { model, counts } = createFakeModel((input) => createFakeMasks(input, background));

    const result = await runEveryoneSegmentation(async () => model, () => ({ ...inputSize }), working, () => false);

    assert.ok(result, `${working.width}x${working.height}`);
    assert.equal(result.length, working.width * working.height);
    const expected = resizeConfidenceBilinear(backgroundToPersonConfidence(background), inputSize, working);
    assert.equal(findMismatch(result, expected), -1, `${working.width}x${working.height}`);
    result[0] = 42;
    assert.equal(background[0], backgroundBefore);
    assert.equal(counts.close, 1);
  }
});

test("마스크 수나 크기가 다르면 예외를 내고 결과를 한 번 닫는다", async () => {
  const inputSize = { width: 4, height: 3 };
  const background = new Float32Array(inputSize.width * inputSize.height);

  const fiveMasks = createFakeModel((input) => createFakeMasks(input, background, 5));
  await assert.rejects(runEveryoneSegmentation(async () => fiveMasks.model, () => ({ ...inputSize }), inputSize, () => false));
  assert.equal(fiveMasks.counts.close, 1);

  const wrongSize = createFakeModel((input) => createFakeMasks(input, background, 6, { width: 5, height: 3 }));
  await assert.rejects(runEveryoneSegmentation(async () => wrongSize.model, () => ({ ...inputSize }), inputSize, () => false));
  assert.equal(wrongSize.counts.close, 1);
});

test("모델을 기다리는 동안 취소되면 입력도 추론도 만들지 않는다", async () => {
  const inputSize = { width: 4, height: 3 };
  const { model, counts } = createFakeModel((input) => createFakeMasks(input, new Float32Array(12)));
  let resolveModel!: (value: typeof model) => void;
  const modelRequest = new Promise<typeof model>((resolve) => {
    resolveModel = resolve;
  });
  let makeInputCount = 0;
  let cancelled = false;

  const running = runEveryoneSegmentation(
    () => modelRequest,
    () => {
      makeInputCount += 1;
      return { ...inputSize };
    },
    inputSize,
    () => cancelled,
  );
  cancelled = true;
  resolveModel(model);

  assert.equal(await running, null);
  assert.equal(makeInputCount, 0);
  assert.equal(counts.segment, 0);
});

test("이미 준비된 모델은 준비 표시를 바꾸지 않는다", async () => {
  const fake = createFakeCreate();
  const loader = createSegmenterLoader(fake.create);
  const ready = loader.get();
  fake.requests[0].resolve(createModel());
  await ready;

  const record: boolean[] = [];
  assert.equal(await waitForModel(loader, (preparing) => record.push(preparing), () => false), true);
  assert.deepEqual(record, []);
});

test("처음 준비가 실패하면 표시를 끄고 다음 시도는 새 요청으로 성공한다", async () => {
  const fake = createFakeCreate();
  const loader = createSegmenterLoader(fake.create);
  const record: boolean[] = [];
  const onPreparingChange = (preparing: boolean) => record.push(preparing);

  const first = waitForModel(loader, onPreparingChange, () => false);
  fake.requests[0].reject(new Error("model download failed"));
  await assert.rejects(first, /model download failed/);
  assert.deepEqual(record, [true, false]);

  const second = waitForModel(loader, onPreparingChange, () => false);
  assert.equal(fake.requests.length, 2);
  fake.requests[1].resolve(createModel());
  assert.equal(await second, true);
  assert.equal(record[record.length - 1], false);
});

test("준비 중 취소한 옛 작업은 새 작업의 준비 표시를 끄지 않는다", async () => {
  const fake = createFakeCreate();
  const loader = createSegmenterLoader(fake.create);
  let preparing = false;
  const onPreparingChange = (next: boolean) => {
    preparing = next;
  };

  let firstCancelled = false;
  const first = waitForModel(loader, onPreparingChange, () => firstCancelled);
  assert.equal(preparing, true);

  firstCancelled = true;
  loader.abandonPending();
  const second = waitForModel(loader, onPreparingChange, () => false);
  assert.equal(fake.requests.length, 2);

  fake.requests[0].resolve(createModel());
  await assert.rejects(first, /segmenter request abandoned/);
  assert.equal(preparing, true);

  fake.requests[1].resolve(createModel());
  assert.equal(await second, true);
  assert.equal(preparing, false);
});

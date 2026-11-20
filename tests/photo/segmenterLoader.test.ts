import test from "node:test";
import assert from "node:assert/strict";

import { createSegmenterLoader } from "../../src/photo/segmentation.ts";

type FakeSegmenter = { name: string; closeCount: number; close(): void };

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createFakeFactory() {
  const requests: Deferred<FakeSegmenter>[] = [];
  const models: FakeSegmenter[] = [];
  let createCount = 0;

  const create = () => {
    createCount += 1;
    const model: FakeSegmenter = {
      name: `m${createCount}`,
      closeCount: 0,
      close() {
        this.closeCount += 1;
      },
    };
    const deferred = createDeferred<FakeSegmenter>();
    requests.push(deferred);
    models.push(model);
    return deferred.promise;
  };

  return { create, requests, models, getCreateCount: () => createCount };
}

test("준비가 끝난 모델은 취소해도 그대로 쓰고 요청을 새로 만들지 않는다", async () => {
  const factory = createFakeFactory();
  const loader = createSegmenterLoader(factory.create);

  const p1 = loader.get();
  const p2 = loader.get();
  assert.equal(p1, p2);
  assert.equal(factory.getCreateCount(), 1);

  factory.requests[0].resolve(factory.models[0]);
  assert.equal(await p1, factory.models[0]);
  assert.equal(await p2, factory.models[0]);

  loader.abandonPending();
  const p3 = loader.get();
  assert.equal(p3, p1);
  assert.equal(factory.getCreateCount(), 1);
  assert.equal(await p3, factory.models[0]);
  assert.equal(factory.models[0].closeCount, 0);
});

test("준비 중에 버린 요청은 늦게 끝나도 새 캐시를 덮거나 지우지 않는다", async () => {
  const factory = createFakeFactory();
  const loader = createSegmenterLoader(factory.create);

  const p1 = loader.get();
  const p1Settled = p1.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  loader.abandonPending();

  const p2 = loader.get();
  const p2Settled = p2.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  loader.abandonPending();

  const p3 = loader.get();
  assert.notEqual(p1, p2);
  assert.notEqual(p2, p3);
  assert.equal(factory.getCreateCount(), 3);

  factory.requests[2].resolve(factory.models[2]);
  assert.equal(await p3, factory.models[2]);

  factory.requests[0].resolve(factory.models[0]);
  const p1Result = await p1Settled;
  assert.equal(p1Result.ok, false);
  assert.equal(factory.models[0].closeCount, 1);

  factory.requests[1].reject(new Error("late failure"));
  const p2Result = await p2Settled;
  assert.equal(p2Result.ok, false);

  const p4 = loader.get();
  assert.equal(p4, p3);
  assert.equal(factory.getCreateCount(), 3);
  assert.equal(await p4, factory.models[2]);
});

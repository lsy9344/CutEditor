import test from "node:test";
import assert from "node:assert/strict";

import {
  applyStrokesToAlpha,
  backgroundToPersonConfidence,
  buildCutoutAlpha,
  buildOutlineAlpha,
  composeCutoutRgba,
  cropChannel,
  findAlphaBounds,
  getOutlineRadius,
  getSegmentInputSize,
  isCutoutTooSmall,
  multiplyAlphaByPhoto,
  refineAlpha,
  resizeConfidenceBilinear,
} from "../../src/photo/cutoutMask.ts";
import { getRestoreClip } from "../../src/photo/cutoutGeometry.ts";

function filledAlpha(length: number, value: number): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(length);
  alpha.fill(value);
  return alpha;
}

function bruteOutline(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const outline = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let hit = false;
      for (let dy = -radius; dy <= radius && !hit; dy += 1) {
        for (let dx = -radius; dx <= radius && !hit; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (dx * dx + dy * dy > radius * radius || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          hit = alpha[ny * width + nx] >= 128;
        }
      }
      outline[y * width + x] = hit ? 255 : 0;
    }
  }
  return outline;
}

test("#1 refineAlpha는 0.35~0.65를 부드럽게 편다", () => {
  const result = refineAlpha(new Float32Array([0, 0.35, 0.4, 0.5, 0.65, 1]));

  assert.deepEqual(Array.from(result), [0, 0, 19, 128, 255, 255]);
});

test("#2 applyStrokesToAlpha는 획이 지나는 픽셀만 0으로 만든다", () => {
  const alpha = filledAlpha(20 * 20, 255);

  applyStrokesToAlpha(alpha, 20, 20, [{ points: [0.5, 0.5], radius: 0.1 }]);

  let zeros = 0;
  let others = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index] === 0) zeros += 1;
    else if (alpha[index] === 255) others += 1;
  }
  assert.equal(zeros, 12);
  assert.equal(others, 388);
});

test("#3 isCutoutTooSmall은 1% 미만일 때만 true다", () => {
  const ninetyNine = new Uint8ClampedArray(100 * 100);
  ninetyNine.fill(255, 0, 99);
  const hundred = new Uint8ClampedArray(100 * 100);
  hundred.fill(255, 0, 100);

  assert.equal(isCutoutTooSmall(ninetyNine), true);
  assert.equal(isCutoutTooSmall(hundred), false);
});

test("#4 findAlphaBounds는 알파 경계를 margin만큼 넓힌다", () => {
  const alpha = new Uint8ClampedArray(10 * 10);
  alpha[4 * 10 + 3] = 255;
  alpha[7 * 10 + 6] = 255;

  assert.deepEqual(findAlphaBounds(alpha, 10, 10, 2), { x: 1, y: 2, width: 8, height: 8 });
});

test("#5 findAlphaBounds는 이미지 밖으로 넓히지 않는다", () => {
  const alpha = new Uint8ClampedArray(10 * 10);
  alpha[0] = 255;

  assert.deepEqual(findAlphaBounds(alpha, 10, 10, 2), { x: 0, y: 0, width: 3, height: 3 });
});

test("#6 findAlphaBounds는 알파가 모두 0이면 null이다", () => {
  assert.equal(findAlphaBounds(new Uint8ClampedArray(10 * 10), 10, 10, 2), null);
});

test("#7 getOutlineRadius는 긴 변의 1.2%와 최소 4px를 쓴다", () => {
  assert.equal(getOutlineRadius(100, 100), 4);
  assert.equal(getOutlineRadius(1000, 2000), 24);
});

test("#8 cropChannel은 rect 영역을 행 단위로 복사한다", () => {
  const data = new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]);

  const cropped = cropChannel(data, 4, { x: 1, y: 0, width: 2, height: 2 });

  assert.deepEqual(Array.from(cropped), [2, 3, 6, 7]);
});

test("#9 buildOutlineAlpha는 전경에서 반지름 안을 255로 채운다", () => {
  const alpha = new Uint8ClampedArray(9 * 9);
  alpha[4 * 9 + 4] = 255;

  const outline = buildOutlineAlpha(alpha, 9, 9, 2);

  let count = 0;
  for (let index = 0; index < outline.length; index += 1) {
    if (outline[index] === 255) count += 1;
  }
  assert.equal(count, 13);
  assert.equal(outline[2 * 9 + 4], 255);
  assert.equal(outline[4 * 9 + 6], 255);
  assert.equal(outline[5 * 9 + 5], 255);
  assert.equal(outline[6 * 9 + 6], 0);
  assert.equal(outline[1 * 9 + 4], 0);
});

test("#10 composeCutoutRgba는 반투명 알파와 흰 테두리를 합성한다", () => {
  const photo = new Uint8ClampedArray([255, 0, 0, 255]);
  const alpha = new Uint8ClampedArray([128]);
  const outline = new Uint8ClampedArray([255]);

  assert.deepEqual(Array.from(composeCutoutRgba(photo, alpha, outline)), [255, 127, 127, 255]);
});

test("#11 composeCutoutRgba는 테두리 없음과 완전 투명을 처리한다", () => {
  const photo = new Uint8ClampedArray([10, 20, 30, 255]);

  assert.deepEqual(
    Array.from(composeCutoutRgba(photo, new Uint8ClampedArray([255]), new Uint8ClampedArray([0]))),
    [10, 20, 30, 255],
  );
  assert.deepEqual(
    Array.from(composeCutoutRgba(photo, new Uint8ClampedArray([0]), new Uint8ClampedArray([255]))),
    [255, 255, 255, 255],
  );
  assert.deepEqual(
    Array.from(composeCutoutRgba(photo, new Uint8ClampedArray([0]), new Uint8ClampedArray([0]))),
    [0, 0, 0, 0],
  );
  assert.deepEqual(
    Array.from(composeCutoutRgba(photo, new Uint8ClampedArray([128]), null)),
    [10, 20, 30, 128],
  );
});

test("#14 거리 변환 결과는 원 안 이웃 전수 확인과 같다", () => {
  let seed = 1;
  const next = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed;
  };

  for (let caseIndex = 0; caseIndex < 400; caseIndex += 1) {
    const width = 3 + (next() % 45);
    const height = 3 + (next() % 45);
    const radius = 1 + (next() % 10);
    const alpha = new Uint8ClampedArray(width * height);
    for (let index = 0; index < alpha.length; index += 1) {
      const roll = next() % 100;
      if (roll < 6) alpha[index] = 255;
      else if (roll < 10) alpha[index] = 127;
    }

    const actual = buildOutlineAlpha(alpha, width, height, radius);
    const expected = bruteOutline(alpha, width, height, radius);
    assert.deepEqual(
      Array.from(actual),
      Array.from(expected),
      `case ${caseIndex}: ${width}x${height} r=${radius}`,
    );
  }
});

test("#15 2048×2048 흰 테두리 계산은 1초 안에 끝난다", () => {
  const width = 2048;
  const height = 2048;
  const alpha = new Uint8ClampedArray(width * height);
  for (let y = 300; y <= 1799; y += 1) {
    alpha.fill(255, y * width + 500, y * width + 1500);
  }

  const start = performance.now();
  const outline = buildOutlineAlpha(alpha, width, height, 25);
  const elapsed = performance.now() - start;

  assert.equal(outline[1000 * width + 1000], 255);
  assert.equal(outline[0], 0);
  assert.ok(elapsed < 1000, `elapsed ${elapsed.toFixed(1)}ms`);
});

test("#16 multiplyAlphaByPhoto는 사진의 알파를 곱한다", () => {
  const alpha = new Uint8ClampedArray([255, 255, 128, 0]);
  const photo = new Uint8ClampedArray(4 * 4);
  photo[0 * 4 + 3] = 255;
  photo[1 * 4 + 3] = 128;
  photo[2 * 4 + 3] = 128;
  photo[3 * 4 + 3] = 255;

  multiplyAlphaByPhoto(alpha, photo);

  assert.deepEqual(Array.from(alpha), [255, 128, 64, 0]);
});

test("#17 buildOutlineAlpha는 지운 자리도 남은 사람에서 반지름 안이면 테두리다", () => {
  const alpha = new Uint8ClampedArray(9 * 9);
  for (let y = 2; y <= 6; y += 1) {
    alpha.fill(255, y * 9 + 2, y * 9 + 7);
  }
  for (let y = 2; y <= 6; y += 1) {
    alpha[y * 9 + 6] = 0;
  }

  const outline = buildOutlineAlpha(alpha, 9, 9, 1);

  assert.equal(outline[4 * 9 + 6], 255);
  assert.equal(outline[4 * 9 + 7], 0);
});

test("#18 buildCutoutAlpha는 사진의 투명한 곳만 사람으로 본 결과를 null로 만든다", () => {
  const photo = new Uint8ClampedArray(10 * 10 * 4);
  for (let y = 0; y < 10; y += 1) {
    for (let x = 5; x < 10; x += 1) {
      photo[(y * 10 + x) * 4 + 3] = 255;
    }
  }

  const transparentConfidence = new Float32Array(10 * 10);
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      transparentConfidence[y * 10 + x] = 1;
    }
  }
  assert.equal(buildCutoutAlpha(transparentConfidence, photo, 10, 10, []), null);

  const personConfidence = new Float32Array(10 * 10);
  for (let y = 0; y < 10; y += 1) {
    for (let x = 5; x < 10; x += 1) {
      personConfidence[y * 10 + x] = 1;
    }
  }
  const alpha = buildCutoutAlpha(personConfidence, photo, 10, 10, []);
  assert.ok(alpha);
  assert.equal(alpha[3 * 10 + 7], 255);
  assert.equal(alpha[3 * 10 + 2], 0);
});

test("#19 모델 입력 크기는 긴 변 512로 줄이고 작으면 그대로 둔다", () => {
  assert.deepEqual(getSegmentInputSize(5184, 3456), { width: 512, height: 341 });
  assert.deepEqual(getSegmentInputSize(300, 200), { width: 300, height: 200 });
  assert.deepEqual(getSegmentInputSize(4000, 1), { width: 512, height: 1 });
  assert.deepEqual(getSegmentInputSize(1, 4000), { width: 1, height: 512 });
  assert.deepEqual(getSegmentInputSize(2048, 2048), { width: 512, height: 512 });
});

test("#20 배경 confidence를 사람 confidence로 뒤집고 0~1로 자른다", () => {
  const background = Float32Array.of(0, 0.25, 1, -0.1, 1.2);
  const person = backgroundToPersonConfidence(background);
  assert.notEqual(person, background);
  const expected = [1, 0.75, 0, 1, 0];
  assert.equal(person.length, expected.length);
  expected.forEach((value, index) => assert.ok(Math.abs(person[index] - value) <= 1e-6, `index ${index}: ${person[index]}`));
  assert.ok(Math.abs(background[1] - 0.25) <= 1e-6);
  assert.ok(Math.abs(background[3] + 0.1) <= 1e-6);
  assert.ok(Math.abs(background[4] - 1.2) <= 1e-6);
});

test("#21 픽셀 중심 기준 bilinear로 작업 크기에 맞춘다", () => {
  const close = (actual: Float32Array, expected: number[]) => {
    assert.equal(actual.length, expected.length);
    expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) <= 1e-6, `index ${index}: ${actual[index]}`));
  };

  const same = Float32Array.of(0.1, 0.2, 0.3, 0.4);
  const copied = resizeConfidenceBilinear(same, { width: 2, height: 2 }, { width: 2, height: 2 });
  assert.notEqual(copied, same);
  close(copied, [0.1, 0.2, 0.3, 0.4]);

  close(resizeConfidenceBilinear(Float32Array.of(0, 1), { width: 2, height: 1 }, { width: 4, height: 1 }), [0, 0.25, 0.75, 1]);
  close(resizeConfidenceBilinear(Float32Array.of(0, 1, 1, 0), { width: 2, height: 2 }, { width: 1, height: 1 }), [0.5]);
});

const fullClip = { x: 0, y: 0, width: 1, height: 1 };

test("#22 같은 자리는 마지막 획이 이긴다", () => {
  const center = 5 * 10 + 5;
  const eraseThenRestore = filledAlpha(10 * 10, 255);
  applyStrokesToAlpha(eraseThenRestore, 10, 10, [
    { points: [0.55, 0.55], radius: 0.1, action: "erase" },
    { points: [0.55, 0.55], radius: 0.1, action: "restore", clip: fullClip },
  ]);
  assert.equal(eraseThenRestore[center], 255);

  const restoreThenErase = filledAlpha(10 * 10, 255);
  applyStrokesToAlpha(restoreThenErase, 10, 10, [
    { points: [0.55, 0.55], radius: 0.1, action: "restore", clip: fullClip },
    { points: [0.55, 0.55], radius: 0.1, action: "erase" },
  ]);
  assert.equal(restoreThenErase[center], 0);
});

test("#23 종류 없는 옛 획은 지움이고 원본이 투명한 곳은 되살려도 투명하다", () => {
  const oldStroke = filledAlpha(10 * 10, 255);
  applyStrokesToAlpha(oldStroke, 10, 10, [{ points: [0.55, 0.55], radius: 0.1 }]);
  assert.equal(oldStroke[5 * 10 + 5], 0);

  const photo = new Uint8ClampedArray(10 * 10 * 4);
  photo.fill(255);
  photo[(5 * 10 + 5) * 4 + 3] = 0;
  const confidence = new Float32Array(10 * 10).fill(1);
  const alpha = buildCutoutAlpha(confidence, photo, 10, 10, [
    { points: [0.55, 0.55], radius: 0.15 },
    { points: [0.55, 0.55], radius: 0.15, action: "restore", clip: fullClip },
  ]);
  assert.ok(alpha);
  assert.equal(alpha[5 * 10 + 5], 0);
  assert.ok(alpha[5 * 10 + 6] > 0);
});

test("#24 되살림은 그 획의 clip 밖을 되살리지 않고 다음 획의 새 clip으로 넓어진다", () => {
  const size = { width: 10, height: 10 };
  const row = (alpha: Uint8ClampedArray, y: number) => Array.from(alpha.slice(y * 10, y * 10 + 10));
  const cover = [0.5, 0.5];

  const alpha = filledAlpha(10 * 10, 0);
  applyStrokesToAlpha(alpha, 10, 10, [
    { points: cover, radius: 1, action: "restore", clip: getRestoreClip({ x: 3, y: 3, width: 4, height: 4 }, size, 0.1) },
  ]);
  // crop 3..6 안쪽과 경계에서 1px(2, 7)은 되살고, 그 밖(1, 8)은 그대로입니다.
  assert.deepEqual(row(alpha, 5), [0, 0, 255, 255, 255, 255, 255, 255, 0, 0]);
  assert.deepEqual(row(alpha, 1), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  applyStrokesToAlpha(alpha, 10, 10, [
    { points: cover, radius: 1, action: "restore", clip: getRestoreClip({ x: 2, y: 2, width: 6, height: 6 }, size, 0.1) },
  ]);
  assert.deepEqual(row(alpha, 5), [0, 255, 255, 255, 255, 255, 255, 255, 255, 0]);
  assert.deepEqual(row(alpha, 0), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  const fractional = (strokeRadius: number) => {
    const result = filledAlpha(10 * 10, 0);
    applyStrokesToAlpha(result, 10, 10, [
      { points: cover, radius: 1, action: "restore", clip: getRestoreClip({ x: 3, y: 3, width: 4, height: 4 }, size, strokeRadius) },
    ]);
    return result[5 * 10 + 1];
  };
  assert.equal(fractional(0.14), 0); // clip 시작 1.6 > 화소 중심 1.5
  assert.equal(fractional(0.16), 255); // clip 시작 1.4 < 화소 중심 1.5
});

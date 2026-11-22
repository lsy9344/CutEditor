import { rasterizeStroke } from "./brushMask.ts";
import type { CutoutRect, CutoutSize } from "./cutoutTypes.ts";
import type { BrushStroke } from "./photoEdits.ts";

const FOREGROUND_ALPHA = 128;

export function refineAlpha(confidence: Float32Array): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(confidence.length);
  for (let index = 0; index < confidence.length; index += 1) {
    let t = (confidence[index] - 0.35) / 0.3;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const smooth = t * t * (3 - 2 * t);
    alpha[index] = Math.round(smooth * 255);
  }
  return alpha;
}

export const SEGMENT_INPUT_MAX_SIDE = 512;

// 사람 자동 모델 입력 크기: 비율을 지키며 긴 변을 maxSide로 줄입니다. 작으면 그대로, 한 변은 최소 1(설계 4.2).
export function getSegmentInputSize(width: number, height: number, maxSide = SEGMENT_INPUT_MAX_SIDE): CutoutSize {
  const longSide = Math.max(width, height);
  if (longSide <= maxSide) return { width, height };
  const scale = maxSide / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// multiclass 모델의 배경 채널(masks[0])을 사람 confidence(1 − 배경)로 뒤집습니다. 0~1로 자르고 새 배열을 돌려줍니다.
export function backgroundToPersonConfidence(background: Float32Array): Float32Array {
  const person = new Float32Array(background.length);
  for (let index = 0; index < background.length; index += 1) {
    const value = 1 - background[index];
    person[index] = value < 0 ? 0 : value > 1 ? 1 : value;
  }
  return person;
}

// 원본 좌표 = (x + 0.5) × from / to − 0.5 (픽셀 중심 기준)를 0~(크기−1)로 자릅니다.
function getBilinearAxis(fromLength: number, toLength: number): { low: Int32Array; high: Int32Array; weight: Float32Array } {
  const low = new Int32Array(toLength);
  const high = new Int32Array(toLength);
  const weight = new Float32Array(toLength);
  for (let index = 0; index < toLength; index += 1) {
    let position = ((index + 0.5) * fromLength) / toLength - 0.5;
    if (position < 0) position = 0;
    if (position > fromLength - 1) position = fromLength - 1;
    const lowIndex = Math.floor(position);
    low[index] = lowIndex;
    high[index] = Math.min(lowIndex + 1, fromLength - 1);
    weight[index] = position - lowIndex;
  }
  return { low, high, weight };
}

// 모델 출력 confidence를 작업 크기로 늘리거나 줄입니다. 같은 크기면 복사본을 돌려줍니다(설계 4.2).
export function resizeConfidenceBilinear(source: Float32Array, from: CutoutSize, to: CutoutSize): Float32Array {
  if (from.width === to.width && from.height === to.height) return source.slice();
  const columns = getBilinearAxis(from.width, to.width);
  const rows = getBilinearAxis(from.height, to.height);
  const resized = new Float32Array(to.width * to.height);
  for (let y = 0; y < to.height; y += 1) {
    const topRow = rows.low[y] * from.width;
    const bottomRow = rows.high[y] * from.width;
    const rowWeight = rows.weight[y];
    for (let x = 0; x < to.width; x += 1) {
      const left = columns.low[x];
      const right = columns.high[x];
      const columnWeight = columns.weight[x];
      const top = source[topRow + left] + (source[topRow + right] - source[topRow + left]) * columnWeight;
      const bottom = source[bottomRow + left] + (source[bottomRow + right] - source[bottomRow + left]) * columnWeight;
      resized[y * to.width + x] = top + (bottom - top) * rowWeight;
    }
  }
  return resized;
}

export function applyStrokesToAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  strokes: BrushStroke[],
): void {
  if (strokes.length === 0) return;
  const mask = new Uint8Array(width * height);
  for (const stroke of strokes) rasterizeStroke(stroke, width, height, mask);
  for (let index = 0; index < alpha.length; index += 1) {
    if (mask[index] === 1) alpha[index] = 0;
  }
}

export function isCutoutTooSmall(alpha: Uint8ClampedArray): boolean {
  let visible = 0;
  for (let index = 0; index < alpha.length; index += 1) {
    if (alpha[index] >= 128) visible += 1;
  }
  return visible / alpha.length < 0.01;
}

export function findAlphaBounds(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  margin: number,
): CutoutRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] < 1) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;

  const x = Math.max(0, minX - margin);
  const y = Math.max(0, minY - margin);
  const right = Math.min(width, maxX + 1 + margin);
  const bottom = Math.min(height, maxY + 1 + margin);
  return { x, y, width: right - x, height: bottom - y };
}

export function getOutlineRadius(width: number, height: number): number {
  return Math.max(4, Math.round(0.012 * Math.max(width, height)));
}

export function cropChannel(
  data: Uint8ClampedArray,
  width: number,
  rect: CutoutRect,
): Uint8ClampedArray {
  const cropped = new Uint8ClampedArray(rect.width * rect.height);
  let target = 0;
  for (let y = 0; y < rect.height; y += 1) {
    const start = (rect.y + y) * width + rect.x;
    for (let x = 0; x < rect.width; x += 1) {
      cropped[target + x] = data[start + x];
    }
    target += rect.width;
  }
  return cropped;
}

// 각 픽셀에서 가장 가까운 전경(알파 128 이상) 픽셀까지 거리의 제곱. 전경이 없으면 Infinity.
// 1) 열마다 위→아래, 아래→위로 훑어 세로 거리를 구하고 제곱합니다.
// 2) 행마다 하한 포락선(Felzenszwalb–Huttenlocher)으로 가로 방향을 합칩니다.
function squaredDistanceToForeground(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): Float64Array {
  const columnSq = new Float64Array(width * height);
  const lastY = new Int32Array(width).fill(-1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alpha[index] >= FOREGROUND_ALPHA) lastY[x] = y;
      columnSq[index] = lastY[x] < 0 ? Infinity : y - lastY[x];
    }
  }
  lastY.fill(-1);
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alpha[index] >= FOREGROUND_ALPHA) lastY[x] = y;
      if (lastY[x] >= 0 && lastY[x] - y < columnSq[index]) columnSq[index] = lastY[x] - y;
    }
  }
  for (let index = 0; index < columnSq.length; index += 1) columnSq[index] *= columnSq[index];

  const result = new Float64Array(width * height);
  const parabolaX = new Int32Array(width);
  const boundary = new Float64Array(width + 1);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    let last = -1;
    for (let q = 0; q < width; q += 1) {
      const fq = columnSq[rowStart + q];
      if (fq === Infinity) continue;
      while (last >= 0) {
        const p = parabolaX[last];
        const s = ((fq + q * q) - (columnSq[rowStart + p] + p * p)) / (2 * q - 2 * p);
        if (s > boundary[last]) {
          last += 1;
          parabolaX[last] = q; boundary[last] = s; boundary[last + 1] = Infinity;
          break;
        }
        last -= 1;
      }
      if (last < 0) { last = 0; parabolaX[0] = q; boundary[0] = -Infinity; boundary[1] = Infinity; }
    }
    if (last < 0) { result.fill(Infinity, rowStart, rowStart + width); continue; }
    let j = 0;
    for (let q = 0; q < width; q += 1) {
      while (boundary[j + 1] < q) j += 1;
      const p = parabolaX[j];
      result[rowStart + q] = (q - p) * (q - p) + columnSq[rowStart + p];
    }
  }
  return result;
}

export function buildOutlineAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const squared = squaredDistanceToForeground(alpha, width, height);
  const radiusSq = radius * radius;
  const outline = new Uint8ClampedArray(width * height);
  for (let index = 0; index < outline.length; index += 1) outline[index] = squared[index] <= radiusSq ? 255 : 0;
  return outline;
}

export function multiplyAlphaByPhoto(alpha: Uint8ClampedArray, photoRgba: Uint8ClampedArray): void {
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = Math.round((alpha[index] * photoRgba[index * 4 + 3]) / 255);
  }
}

export function composeCutoutRgba(
  photo: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
  outlineAlpha: Uint8ClampedArray | null,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(photo.length);
  for (let index = 0; index < alpha.length; index += 1) {
    const a = alpha[index] / 255;
    const o = outlineAlpha ? outlineAlpha[index] / 255 : 0;
    const outA = a + o * (1 - a);
    const offset = index * 4;
    if (outA === 0) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      result[offset + channel] = Math.round(
        (photo[offset + channel] * a + 255 * o * (1 - a)) / outA,
      );
    }
    result[offset + 3] = Math.round(outA * 255);
  }
  return result;
}

export function buildCutoutAlpha(
  confidence: Float32Array,
  photoRgba: Uint8ClampedArray,
  width: number,
  height: number,
  eraseStrokes: BrushStroke[],
): Uint8ClampedArray | null {
  const alpha = refineAlpha(confidence);
  applyStrokesToAlpha(alpha, width, height, eraseStrokes);
  multiplyAlphaByPhoto(alpha, photoRgba);
  if (isCutoutTooSmall(alpha)) return null;
  return alpha;
}

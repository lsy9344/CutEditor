import type { PhotoAdjust } from "./photoEdits.ts";
import { isIdentityAdjust } from "./photoEdits.ts";

type ColorMatrix = number[]; // 길이 12: [a0,a1,a2,a3, b0,b1,b2,b3, c0,c1,c2,c3]

const IDENTITY_MATRIX: ColorMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

// later · earlier (earlier를 먼저 적용)
function composeColorMatrix(later: ColorMatrix, earlier: ColorMatrix): ColorMatrix {
  const result: ColorMatrix = new Array(12);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let sum = column === 3 ? later[row * 4 + 3] : 0;
      for (let k = 0; k < 3; k += 1) sum += later[row * 4 + k] * earlier[k * 4 + column];
      result[row * 4 + column] = sum;
    }
  }
  return result;
}

const ADJUST_STEPS: ((adjust: PhotoAdjust) => ColorMatrix)[] = [
  (adjust) => {
    const d = adjust.brightness * 1.28;
    return [1, 0, 0, d, 0, 1, 0, d, 0, 0, 1, d];
  },
  (adjust) => {
    const k = (100 + adjust.contrast) / 100;
    const t = 128 - 128 * k;
    return [k, 0, 0, t, 0, k, 0, t, 0, 0, k, t];
  },
  (adjust) => {
    const s = (100 + adjust.saturation) / 100;
    const wr = 0.299 * (1 - s);
    const wg = 0.587 * (1 - s);
    const wb = 0.114 * (1 - s);
    return [wr + s, wg, wb, 0, wr, wg + s, wb, 0, wr, wg, wb + s, 0];
  },
  (adjust) => {
    const t = adjust.warmth * 0.3;
    return [1, 0, 0, t, 0, 1, 0, 0, 0, 0, 1, -t];
  },
];

export function applyPhotoAdjust(data: Uint8ClampedArray, adjust: PhotoAdjust): void {
  if (isIdentityAdjust(adjust)) return;
  const matrix = ADJUST_STEPS.reduce(
    (combined, step) => composeColorMatrix(step(adjust), combined),
    IDENTITY_MATRIX,
  );
  const [a0, a1, a2, a3, b0, b1, b2, b3, c0, c1, c2, c3] = matrix;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    data[index] = a0 * r + a1 * g + a2 * b + a3;
    data[index + 1] = b0 * r + b1 * g + b2 * b + b3;
    data[index + 2] = c0 * r + c1 * g + c2 * b + c3;
  }
}

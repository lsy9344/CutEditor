export const INPAINT_PADDING = 16;
const COARSEST_SIDE = 24;
const COARSEST_ITERATIONS = 200;
const LEVEL_ITERATIONS = 12;

// 마스크(1)인 픽셀의 위치를 오름차순으로 모읍니다.
function collectMaskedIndices(mask: Uint8Array): Int32Array {
  let count = 0;
  for (let index = 0; index < mask.length; index += 1) if (mask[index]) count += 1;
  const indices = new Int32Array(count);
  let cursor = 0;
  for (let index = 0; index < mask.length; index += 1) if (mask[index]) indices[cursor++] = index;
  return indices;
}

// 마스크 픽셀을 상하좌우 이웃 평균으로 iterations번 바꿉니다(가우스-자이델, 제자리 갱신).
// 마스크 픽셀만 오름차순으로 돌므로, 전체를 훑는 방식과 결과가 같고 더 빠릅니다.
function fillLevel(rgb: Float32Array, width: number, height: number, maskedIndices: Int32Array, iterations: number): void {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let k = 0; k < maskedIndices.length; k += 1) {
      const index = maskedIndices[k];
      const x = index % width;
      const y = (index - x) / width;
      let r = 0; let g = 0; let b = 0; let n = 0;
      if (x > 0) { const j = index - 1; r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n += 1; }
      if (x < width - 1) { const j = index + 1; r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n += 1; }
      if (y > 0) { const j = index - width; r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n += 1; }
      if (y < height - 1) { const j = index + width; r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n += 1; }
      rgb[index * 3] = r / n; rgb[index * 3 + 1] = g / n; rgb[index * 3 + 2] = b / n;
    }
  }
}

// 2배씩 줄인 단계에서 먼저 메우고, 원래 크기로 올라오며 다듬습니다.
function inpaintRegion(rgb: Float32Array, mask: Uint8Array, width: number, height: number): void {
  const maskedIndices = collectMaskedIndices(mask);
  if (Math.max(width, height) <= COARSEST_SIDE) {
    // 가장 작은 단계: 알려진 픽셀(마스크 0) 평균으로 채운 뒤 반복
    let r = 0; let g = 0; let b = 0; let n = 0;
    for (let index = 0; index < width * height; index += 1) {
      if (mask[index]) continue;
      r += rgb[index * 3]; g += rgb[index * 3 + 1]; b += rgb[index * 3 + 2]; n += 1;
    }
    if (n === 0) return; // 알려진 픽셀이 없으면 그대로 둡니다
    for (let k = 0; k < maskedIndices.length; k += 1) {
      const index = maskedIndices[k];
      rgb[index * 3] = r / n; rgb[index * 3 + 1] = g / n; rgb[index * 3 + 2] = b / n;
    }
    fillLevel(rgb, width, height, maskedIndices, COARSEST_ITERATIONS);
    return;
  }
  // 한 단계 작은 이미지: 2×2 블록의 알려진 픽셀 평균. 알려진 픽셀이 없으면 그 칸도 마스크(1)
  const coarseWidth = Math.ceil(width / 2);
  const coarseHeight = Math.ceil(height / 2);
  const coarseRgb = new Float32Array(coarseWidth * coarseHeight * 3);
  const coarseMask = new Uint8Array(coarseWidth * coarseHeight);
  for (let y = 0; y < coarseHeight; y += 1) {
    for (let x = 0; x < coarseWidth; x += 1) {
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const sourceX = x * 2 + dx; const sourceY = y * 2 + dy;
          if (sourceX >= width || sourceY >= height) continue;
          const index = sourceY * width + sourceX;
          if (mask[index]) continue;
          r += rgb[index * 3]; g += rgb[index * 3 + 1]; b += rgb[index * 3 + 2]; n += 1;
        }
      }
      const coarseIndex = y * coarseWidth + x;
      if (n === 0) { coarseMask[coarseIndex] = 1; continue; }
      coarseRgb[coarseIndex * 3] = r / n; coarseRgb[coarseIndex * 3 + 1] = g / n; coarseRgb[coarseIndex * 3 + 2] = b / n;
    }
  }
  inpaintRegion(coarseRgb, coarseMask, coarseWidth, coarseHeight);
  // 작은 단계의 값을 마스크 픽셀에 복사한 뒤 다듬습니다
  for (let k = 0; k < maskedIndices.length; k += 1) {
    const index = maskedIndices[k];
    const x = index % width;
    const y = (index - x) / width;
    const coarseIndex = Math.min(coarseHeight - 1, y >> 1) * coarseWidth + Math.min(coarseWidth - 1, x >> 1);
    rgb[index * 3] = coarseRgb[coarseIndex * 3]; rgb[index * 3 + 1] = coarseRgb[coarseIndex * 3 + 1]; rgb[index * 3 + 2] = coarseRgb[coarseIndex * 3 + 2];
  }
  fillLevel(rgb, width, height, maskedIndices, LEVEL_ITERATIONS);
}

function inpaintMaskRegion(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): void {
  const startX = Math.max(0, minX - INPAINT_PADDING);
  const startY = Math.max(0, minY - INPAINT_PADDING);
  const endX = Math.min(width - 1, maxX + INPAINT_PADDING);
  const endY = Math.min(height - 1, maxY + INPAINT_PADDING);
  const regionWidth = endX - startX + 1;
  const regionHeight = endY - startY + 1;

  const regionRgb = new Float32Array(regionWidth * regionHeight * 3);
  const regionMask = new Uint8Array(regionWidth * regionHeight);
  for (let y = 0; y < regionHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const sourceIndex = (startY + y) * width + (startX + x);
      const regionIndex = y * regionWidth + x;
      regionRgb[regionIndex * 3] = rgba[sourceIndex * 4];
      regionRgb[regionIndex * 3 + 1] = rgba[sourceIndex * 4 + 1];
      regionRgb[regionIndex * 3 + 2] = rgba[sourceIndex * 4 + 2];
      regionMask[regionIndex] = mask[sourceIndex] ? 1 : 0;
    }
  }

  inpaintRegion(regionRgb, regionMask, regionWidth, regionHeight);

  for (let y = 0; y < regionHeight; y += 1) {
    for (let x = 0; x < regionWidth; x += 1) {
      const regionIndex = y * regionWidth + x;
      if (!regionMask[regionIndex]) continue;
      const sourceIndex = (startY + y) * width + (startX + x);
      rgba[sourceIndex * 4] = regionRgb[regionIndex * 3];
      rgba[sourceIndex * 4 + 1] = regionRgb[regionIndex * 3 + 1];
      rgba[sourceIndex * 4 + 2] = regionRgb[regionIndex * 3 + 2];
    }
  }
}

export function inpaintMasked(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8Array,
): void {
  let maskCount = 0;
  for (let index = 0; index < mask.length; index += 1) if (mask[index]) maskCount += 1;
  if (maskCount === 0 || maskCount === width * height) return;

  // 서로 떨어진 마스크(획)는 각각의 경계 상자만 메운다.
  // 하나의 큰 상자로 묶으면 그 사이의 빈 영역까지 계산해 느려진다.
  const visited = new Uint8Array(mask.length);
  const stack = new Int32Array(maskCount);

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;

    let stackSize = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    stack[stackSize++] = start;
    visited[start] = 1;

    while (stackSize > 0) {
      const index = stack[--stackSize];
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const next = index - 1;
        if (mask[next] && !visited[next]) { visited[next] = 1; stack[stackSize++] = next; }
      }
      if (x < width - 1) {
        const next = index + 1;
        if (mask[next] && !visited[next]) { visited[next] = 1; stack[stackSize++] = next; }
      }
      if (y > 0) {
        const next = index - width;
        if (mask[next] && !visited[next]) { visited[next] = 1; stack[stackSize++] = next; }
      }
      if (y < height - 1) {
        const next = index + width;
        if (mask[next] && !visited[next]) { visited[next] = 1; stack[stackSize++] = next; }
      }
    }

    inpaintMaskRegion(rgba, width, height, mask, minX, minY, maxX, maxY);
  }
}

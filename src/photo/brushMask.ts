import type { BrushStroke } from "./photoEdits.ts";

function distanceSquaredToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const offsetX = px - closestX;
  const offsetY = py - closestY;
  return offsetX * offsetX + offsetY * offsetY;
}

export function rasterizeStroke(
  stroke: BrushStroke,
  width: number,
  height: number,
  mask: Uint8Array,
  bounds?: { x0: number; y0: number; x1: number; y1: number }, // 칠할 화소 범위(양끝 포함). 없으면 사진 전체
): void {
  const minX = bounds ? Math.max(0, bounds.x0) : 0;
  const minY = bounds ? Math.max(0, bounds.y0) : 0;
  const maxX = bounds ? Math.min(width - 1, bounds.x1) : width - 1;
  const maxY = bounds ? Math.min(height - 1, bounds.y1) : height - 1;
  const radius = stroke.radius * width;
  const radiusSquared = radius * radius;
  const pointCount = Math.floor(stroke.points.length / 2);
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const ax = stroke.points[pointIndex * 2] * width;
    const ay = stroke.points[pointIndex * 2 + 1] * height;
    const nextIndex = Math.min(pointIndex + 1, pointCount - 1);
    const bx = stroke.points[nextIndex * 2] * width;
    const by = stroke.points[nextIndex * 2 + 1] * height;

    const startX = Math.max(minX, Math.floor(Math.min(ax, bx) - radius));
    const endX = Math.min(maxX, Math.ceil(Math.max(ax, bx) + radius));
    const startY = Math.max(minY, Math.floor(Math.min(ay, by) - radius));
    const endY = Math.min(maxY, Math.ceil(Math.max(ay, by) + radius));

    for (let y = startY; y <= endY; y += 1) {
      const pixelY = y + 0.5;
      for (let x = startX; x <= endX; x += 1) {
        const pixelX = x + 0.5;
        if (distanceSquaredToSegment(pixelX, pixelY, ax, ay, bx, by) <= radiusSquared) {
          mask[y * width + x] = 1;
        }
      }
    }
  }
}

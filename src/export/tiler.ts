// 타일 분할 유틸리티 (고해상도 캔버스 타일링)

export type Tile = { x: number; y: number; w: number; h: number };

export const makeTiles = (
  totalW: number,
  totalH: number,
  maxTileSize = 4096
): Tile[] => {
  const tiles: Tile[] = [];
  for (let y = 0; y < totalH; y += maxTileSize) {
    for (let x = 0; x < totalW; x += maxTileSize) {
      tiles.push({
        x,
        y,
        w: Math.min(maxTileSize, totalW - x),
        h: Math.min(maxTileSize, totalH - y),
      });
    }
  }
  return tiles;
};


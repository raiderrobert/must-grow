/**
 * Pure math functions for the minimap — no Phaser dependency so they're unit-testable.
 */

/**
 * Compute the view range (world-px represented by the full minimap square).
 * Uses the 4th-nearest body distance * 1.3, minimum 10,000.
 */
export function computeViewRange(distances: number[]): number {
  if (distances.length === 0) return 10_000;
  const sorted = [...distances].sort((a, b) => a - b);
  const idx = Math.min(3, sorted.length - 1); // 4th nearest (0-indexed = 3)
  return Math.max(sorted[idx] * 1.3, 10_000);
}

export interface MinimapPos {
  x: number;
  y: number;
  clamped: boolean;
}

/**
 * Map a world position to minimap pixel coordinates.
 * Clamps to map edges if outside bounds.
 */
export function worldToMinimap(
  worldX: number, worldY: number,
  playerX: number, playerY: number,
  viewRange: number,
  mapOriginX: number, mapOriginY: number,
  mapSize: number
): MinimapPos {
  const halfMap = mapSize / 2;
  const centerX = mapOriginX + halfMap;
  const centerY = mapOriginY + halfMap;

  const relX = (worldX - playerX) / viewRange * halfMap;
  const relY = (worldY - playerY) / viewRange * halfMap;

  const margin = 2;
  const minX = mapOriginX + margin;
  const maxX = mapOriginX + mapSize - margin;
  const minY = mapOriginY + margin;
  const maxY = mapOriginY + mapSize - margin;

  const rawX = centerX + relX;
  const rawY = centerY + relY;

  const clampedX = Math.max(minX, Math.min(maxX, rawX));
  const clampedY = Math.max(minY, Math.min(maxY, rawY));
  const clamped = clampedX !== rawX || clampedY !== rawY;

  return { x: clampedX, y: clampedY, clamped };
}

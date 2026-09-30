// How dark the Fog is over each tile, for the renderer's Fog texture (one pixel a tile, drawn
// with linear filtering, so the edges come out soft). The sim says which tiles are Revealed and
// In sight; this only turns that into darkness. No Pixi here.
import { hasTile, type TileBits } from '@candlemarch/sim';

/** Darkness (0–255) over an unrevealed tile: nothing on it shows. */
export const FOG_DARK = 255;
/** Darkness over a Revealed tile that isn't In sight: drawn as last seen, dimmed. */
export const FOG_DIM = 120;

export interface FogMap {
  width: number;
  height: number;
  revealed: TileBits;
  inSight: TileBits;
}

/**
 * Darkness per pixel of a `(width + 2)` × `(height + 2)` field: tile (x, y) is pixel (x + 1, y + 1),
 * and the one-pixel border repeats the edge tiles so the map's edge is covered like its tiles.
 * Each tile is at least as dark as its own state, and as dark as the mean of the 3×3 tiles round
 * it: an edge fades into the side the player sees, never lighting up a darker tile.
 */
export function fogField(map: FogMap): Uint8ClampedArray {
  const { width, height } = map;
  const own = new Uint8Array(width * height);
  for (let i = 0; i < own.length; i++) {
    own[i] = hasTile(map.inSight, i) ? 0 : hasTile(map.revealed, i) ? FOG_DIM : FOG_DARK;
  }
  const clampX = (x: number) => (x < 0 ? 0 : x >= width ? width - 1 : x);
  const clampY = (y: number) => (y < 0 ? 0 : y >= height ? height - 1 : y);
  const soft = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const row = clampY(y + dy) * width;
        for (let dx = -1; dx <= 1; dx++) sum += own[row + clampX(x + dx)] as number;
      }
      soft[y * width + x] = Math.max(own[y * width + x] as number, Math.round(sum / 9));
    }
  }
  const fieldWidth = width + 2;
  const field = new Uint8ClampedArray(fieldWidth * (height + 2));
  for (let py = 0; py < height + 2; py++) {
    const row = clampY(py - 1) * width;
    for (let px = 0; px < fieldWidth; px++) {
      field[py * fieldWidth + px] = soft[row + clampX(px - 1)] as number;
    }
  }
  return field;
}

/** Whether two tile-bit layers hold the same tiles. */
export function sameBits(a: TileBits, b: TileBits): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

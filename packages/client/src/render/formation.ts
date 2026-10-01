/**
 * Walkers standing still on one tile are drawn fanned out within it, so each one shows (drawing
 * only: the sim keeps them on the same spot).
 */

/** A walker standing still, and the tile it stands on. */
export interface StandingWalker {
  id: number;
  tile: { x: number; y: number };
}

/** A shift in grid coordinates (tiles) from where the sim puts a walker. */
export interface Offset {
  x: number;
  y: number;
}

/**
 * Where each walker sharing a tile is drawn, as a shift from its position, by ID. Walkers alone on
 * their tile get none.
 */
export function formationOffsets(standing: readonly StandingWalker[]): Record<number, Offset> {
  const byTile = new Map<string, number[]>();
  for (const { id, tile } of standing) {
    const key = `${tile.x},${tile.y}`;
    const ids = byTile.get(key);
    if (ids) ids.push(id);
    else byTile.set(key, [id]);
  }
  const offsets: Record<number, Offset> = {};
  for (const ids of byTile.values()) {
    if (ids.length < 2) continue;
    ids.sort((a, b) => a - b);
    ids.forEach((id, slot) => {
      offsets[id] = ringSlot(slot, ids.length);
    });
  }
  return offsets;
}

/**
 * Slot `slot` of `n` on a ring round the tile's centre, the first at the left of the screen (grid
 * direction (-1, 1)) and the rest round it. The ring widens with the crowd, staying inside the tile.
 */
function ringSlot(slot: number, n: number): Offset {
  const radius = Math.min(0.4, 0.16 + 0.03 * n);
  const angle = (3 * Math.PI) / 4 - (2 * Math.PI * slot) / n;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** How quickly a walker slides into or out of its slot: the time constant of the ease, in ms. */
const EASE_MS = 60;

/**
 * A walker's drawn shift `dtMs` after it was at `current`, sliding towards `target` (its slot, or
 * none once it walks on) and settling within about a third of a second.
 */
export function easeOffset(current: Offset, target: Offset, dtMs: number): Offset {
  const keep = Math.exp(-Math.max(0, dtMs) / EASE_MS);
  const x = target.x + (current.x - target.x) * keep;
  const y = target.y + (current.y - target.y) * keep;
  // Close enough: settle exactly, so a walker at rest isn't nudged every frame.
  if (Math.abs(x - target.x) < 0.001 && Math.abs(y - target.y) < 0.001) return { ...target };
  return { x, y };
}

// How the tree on a tile looks: its species, from the wood (region) the tile lies in, and its own
// size, lean, shade and shape, from a hash of the tile. Visual only: the sim has one `tree`, and
// this is worked out from the tile alone, so it's the same every time it's drawn and a Sapling,
// tree and Stump on one tile are always one species. No Pixi here.

/** The kinds of tree a wood can be: oakwood, pinewood, birchwood. */
export const TREE_SPECIES = ['oak', 'pine', 'birch'] as const;
export type TreeSpecies = (typeof TREE_SPECIES)[number];

/** How one tree looks. */
export interface TreeLook {
  species: TreeSpecies;
  /** Its size against the species' usual: 0.85–1.15. */
  size: number;
  /** Which way, and how far, it leans: −1 (west) to 1 (east) on screen. */
  lean: number;
  /** Which of the species' shades it takes: 0, 1 or 2. */
  shade: number;
  /** Which of a few crown shapes it grows: 0–3. */
  shape: number;
}

/** Tiles a side of the cells woods are laid out on: each cell has a heart, and one species. */
const WOOD_CELL_TILES = 14;

/**
 * A well-mixed 32-bit hash of a tile and a salt, so each property varies on its own. Also the
 * Mountains' relief (`relief.ts`).
 */
export function tileHash(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A hash as a number in [0, 1). */
function unit(x: number, y: number, salt: number): number {
  return tileHash(x, y, salt) / 4294967296;
}

/**
 * The species of the wood tile (x, y) lies in: that of the nearest wood heart (one at a random
 * spot in each cell of `WOOD_CELL_TILES`), so woods are patches with ragged, irregular edges. A
 * little noise on the distance mixes a few trees across each border.
 */
function speciesAt(x: number, y: number): TreeSpecies {
  const cx = Math.floor(x / WOOD_CELL_TILES);
  const cy = Math.floor(y / WOOD_CELL_TILES);
  let best = Number.POSITIVE_INFINITY;
  let species: TreeSpecies = 'oak';
  for (let j = cy - 1; j <= cy + 1; j++) {
    for (let i = cx - 1; i <= cx + 1; i++) {
      const hx = (i + 0.15 + 0.7 * unit(i, j, 1)) * WOOD_CELL_TILES;
      const hy = (j + 0.15 + 0.7 * unit(i, j, 2)) * WOOD_CELL_TILES;
      const d = Math.hypot(x + 0.5 - hx, y + 0.5 - hy) + 2 * unit(x, y, 3);
      if (d < best) {
        best = d;
        species = TREE_SPECIES[tileHash(i, j, 4) % TREE_SPECIES.length] as TreeSpecies;
      }
    }
  }
  return species;
}

/** The tree on tile (x, y), however often it's asked. */
export function treeLook(x: number, y: number): TreeLook {
  return {
    species: speciesAt(x, y),
    size: 0.85 + 0.05 * (tileHash(x, y, 5) % 7),
    lean: ((tileHash(x, y, 6) % 5) - 2) / 2,
    shade: tileHash(x, y, 7) % 3,
    shape: tileHash(x, y, 8) % 4,
  };
}

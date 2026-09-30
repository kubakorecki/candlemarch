// Fog on screen (spec, World and map; ADR-0005): one texture with a pixel per tile (`fogField`),
// laid over the world in grid space and drawn with linear filtering, so its edges come out soft.
// Redrawn only when the Revealed or In-sight tiles change.
import type { GameState, TileBits } from '@candlemarch/sim';
import { Matrix, Sprite, Texture } from 'pixi.js';
import { fogField, sameBits } from './fogField';
import { TILE_H, TILE_W } from './iso';
import { palette } from './palette';

export class FogLayer {
  /** Goes over everything drawn on the map, under the placement ghost. */
  readonly node = new Sprite();
  private canvas: HTMLCanvasElement | null = null;
  private image: ImageData | null = null;
  private drawnRevealed: TileBits | null = null;
  private drawnInSight: TileBits | null = null;

  constructor() {
    this.node.visible = false;
    // Pixel (px, py) covers tile (px - 1, py - 1): the texture has a pixel of border round the map.
    this.node.setFromMatrix(
      new Matrix(TILE_W / 2, TILE_H / 2, -TILE_W / 2, TILE_H / 2, 0, -TILE_H),
    );
  }

  /** Shows the Fog while it's on, redrawn if the tiles differ from those last drawn. */
  sync(state: GameState): void {
    const { map } = state;
    this.node.visible = state.fog;
    if (!state.fog) return;
    const w = map.width + 2;
    const h = map.height + 2;
    if (!this.canvas || this.canvas.width !== w || this.canvas.height !== h) this.resize(w, h);
    if (
      this.drawnRevealed &&
      this.drawnInSight &&
      (map.revealed === this.drawnRevealed || sameBits(map.revealed, this.drawnRevealed)) &&
      sameBits(map.inSight, this.drawnInSight)
    ) {
      return;
    }
    this.drawnRevealed = map.revealed;
    this.drawnInSight = map.inSight;
    const { canvas, image } = this;
    if (!canvas || !image) return;
    const field = fogField(map);
    const data = image.data;
    for (let i = 0; i < field.length; i++) data[i * 4 + 3] = field[i] as number;
    canvas.getContext('2d')?.putImageData(image, 0, 0);
    this.node.texture.source.update();
  }

  private resize(w: number, h: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const image = new ImageData(w, h);
    const r = (palette.fog >> 16) & 0xff;
    const g = (palette.fog >> 8) & 0xff;
    const b = palette.fog & 0xff;
    for (let i = 0; i < w * h; i++) {
      image.data[i * 4] = r;
      image.data[i * 4 + 1] = g;
      image.data[i * 4 + 2] = b;
    }
    const old = this.node.texture;
    const texture = Texture.from(canvas);
    texture.source.scaleMode = 'linear';
    this.node.texture = texture;
    if (old !== Texture.EMPTY) old.destroy(true);
    this.canvas = canvas;
    this.image = image;
    this.drawnRevealed = null;
    this.drawnInSight = null;
  }
}

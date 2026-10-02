// Villager art: one figure, dressed and equipped for its Job so a woodcutter reads apart from a
// fisher at a glance. Drawn around (0, 0) = the feet, facing the camera, in the style of shapes.ts.
import type { JobId } from '@candlemarch/content';
import type { Graphics } from 'pixi.js';
import { TILE_H } from './iso';
import { palette } from './palette';
import { groundShadowAt, INK, THIN_INK } from './shapes';

const S = TILE_H / 64;
const HEAD_Y = -40 * S;
const HEAD_R = 7.5 * S;
/** Where the hands hang, either side of the body. */
const HAND_X = 10.5 * S;
const HAND_Y = -15 * S;

/** Tunic colour per Job; also the HUD avatars'. */
export const JOB_COLORS: Record<JobId, number> = {
  carrier: palette.carrier,
  woodcutter: palette.woodcutter,
  woodsplitter: palette.woodsplitter,
  fisher: palette.fisher,
  forager: palette.forager,
  hunter: palette.hunter,
  forester: palette.forester,
  watchman: palette.watchman,
  quarryman: palette.quarryman,
  clay_digger: palette.clayDigger,
  miner: palette.miner,
  bog_digger: palette.bogDigger,
  farmer: palette.farmer,
  charcoal_burner: palette.charcoalBurner,
  sawyer: palette.sawyer,
  stonecutter: palette.stonecutter,
  brickmaker: palette.brickmaker,
  smoker: palette.smoker,
  smelter: palette.smelter,
  brewer: palette.brewer,
};

/** A stick from (x1, y1) to (x2, y2): an ink edge round a line of `color`. */
function pole(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: number,
): void {
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({ width: width + 3 * S, color: palette.ink, cap: 'round' });
  g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width, color, cap: 'round' });
}

/**
 * A villager dressed for `job`: what it carries on its back, legs and boots, a tunic in the Job's
 * colour, hands, head and headgear. The tool in its hands is `drawVillagerTool`, drawn over this.
 */
export function drawVillager(g: Graphics, job: JobId): void {
  g.clear();
  const tunic = JOB_COLORS[job];
  groundShadowAt(g, 0, 0, 12 * S, 5 * S);
  drawBackGear(g, job);
  // Legs and boots.
  for (const side of [-1, 1]) {
    g.rect(side === -1 ? -6 * S : 1 * S, -12 * S, 5 * S, 10 * S)
      .fill(palette.trousers)
      .stroke(THIN_INK);
    g.roundRect(side === -1 ? -7 * S : 0.5 * S, -4 * S, 6.5 * S, 4.5 * S, 2 * S)
      .fill(palette.boots)
      .stroke({ ...THIN_INK, width: 1.5 * S });
  }
  // Arms behind the tunic's edge, hands at their ends.
  for (const side of [-1, 1]) {
    g.roundRect(side * HAND_X - 3 * S, -31 * S, 6 * S, 17 * S, 3 * S)
      .fill(tunic)
      .stroke(THIN_INK);
  }
  // Tunic: narrow at the shoulders, flaring to the hem.
  g.poly([
    -6 * S,
    -33 * S,
    6 * S,
    -33 * S,
    9 * S,
    -29 * S,
    10.5 * S,
    -9 * S,
    -10.5 * S,
    -9 * S,
    -9 * S,
    -29 * S,
  ])
    .fill(tunic)
    .stroke(INK);
  if (job === 'woodsplitter') {
    // A leather apron over the tunic.
    g.poly([-5 * S, -27 * S, 5 * S, -27 * S, 7 * S, -8 * S, -7 * S, -8 * S])
      .fill(palette.apron)
      .stroke(THIN_INK);
    g.moveTo(-5 * S, -27 * S)
      .lineTo(-3 * S, -33 * S)
      .moveTo(5 * S, -27 * S)
      .lineTo(3 * S, -33 * S);
    g.stroke({ width: 1.5 * S, color: palette.ink });
  }
  if (job === 'woodcutter') {
    // Checks on the shirt.
    for (const y of [-26, -20, -14]) g.moveTo(-9 * S, y * S).lineTo(9.5 * S, y * S);
    for (const x of [-4, 1.5, 7]) g.moveTo(x * S, -32 * S).lineTo(x * S, -10 * S);
    g.stroke({ width: 1.5 * S, color: palette.ink, alpha: 0.3 });
  }
  if (job === 'carrier') {
    // The sack's strap across the chest.
    g.moveTo(-8 * S, -31 * S)
      .lineTo(9 * S, -12 * S)
      .stroke({ width: 3 * S, color: palette.belt, cap: 'round' });
  }
  if (job === 'watchman') {
    // A pale tabard stripe down the front.
    g.rect(-2.5 * S, -32 * S, 5 * S, 22 * S).fill(palette.bone);
  }
  g.moveTo(-10 * S, -17 * S)
    .lineTo(10 * S, -17 * S)
    .stroke({ width: 2.5 * S, color: palette.belt });
  for (const side of [-1, 1]) {
    g.circle(side * HAND_X, HAND_Y, 2.8 * S)
      .fill(palette.skin)
      .stroke({ ...THIN_INK, width: 1.5 * S });
  }
  drawHead(g, job);
}

/** What a villager carries on its back, peeking out behind it: drawn before the body. */
function drawBackGear(g: Graphics, job: JobId): void {
  if (job === 'carrier') {
    // A bulging sack slung over the right shoulder.
    g.ellipse(10 * S, -37 * S, 9 * S, 10 * S)
      .fill(palette.sack)
      .stroke(INK);
    g.moveTo(6 * S, -45 * S)
      .lineTo(9 * S, -41 * S)
      .stroke({ width: 1.5 * S, color: palette.sackDark });
  } else if (job === 'hunter') {
    // A quiver over the right shoulder, fletchings showing.
    g.poly([9 * S, -47 * S, 14 * S, -45 * S, 3 * S, -16 * S, -2 * S, -18 * S])
      .fill(palette.apron)
      .stroke(THIN_INK);
    for (const [x, y] of [
      [8, -51],
      [11, -53],
      [14, -50],
    ] as const) {
      g.poly([
        x * S,
        y * S,
        (x + 3) * S,
        (y + 1) * S,
        (x + 2) * S,
        (y + 6) * S,
        (x - 1) * S,
        (y + 5) * S,
      ])
        .fill(palette.bone)
        .stroke({ ...THIN_INK, width: 1.2 * S });
    }
  }
}

/** The head, with the Job's hat, hood or helmet (and the woodcutter's beard). */
function drawHead(g: Graphics, job: JobId): void {
  const y = HEAD_Y;
  const r = HEAD_R;
  if (job === 'forager') {
    // A deep hood: its back behind the face, a point on top.
    g.poly([
      -10 * S,
      y + 4 * S,
      -9 * S,
      y - 6 * S,
      0,
      y - 13 * S,
      9 * S,
      y - 6 * S,
      10 * S,
      y + 4 * S,
      7 * S,
      y + 9 * S,
      -7 * S,
      y + 9 * S,
    ])
      .fill(palette.hood)
      .stroke(INK);
    g.circle(0, y + 1 * S, r * 0.82)
      .fill(palette.skin)
      .stroke(THIN_INK);
    return;
  }
  if (job === 'woodcutter') {
    g.circle(0, y, r).fill(palette.skin).stroke(INK);
    // A full beard over the chin.
    g.poly([
      -7 * S,
      y + 2 * S,
      -3 * S,
      y + 4 * S,
      3 * S,
      y + 4 * S,
      7 * S,
      y + 2 * S,
      5 * S,
      y + 8 * S,
      0,
      y + 11 * S,
      -5 * S,
      y + 8 * S,
    ])
      .fill(palette.beard)
      .stroke(THIN_INK);
    // A knitted cap with a turned-up band.
    g.moveTo(-8 * S, y - 2 * S)
      .arc(0, y - 2 * S, 8 * S, Math.PI, 0)
      .closePath()
      .fill(palette.knitCap)
      .stroke(INK);
    g.roundRect(-8.5 * S, y - 4 * S, 17 * S, 4 * S, 1.5 * S)
      .fill(palette.knitCap)
      .stroke(THIN_INK);
    return;
  }
  g.circle(0, y, r).fill(palette.skin).stroke(INK);
  if (job === 'carrier') {
    // A cloth cap.
    g.moveTo(-7.5 * S, y - 2 * S)
      .arc(0, y - 2 * S, 7.5 * S, Math.PI, 0)
      .closePath()
      .fill(palette.clothCap)
      .stroke(INK);
    g.moveTo(-2 * S, y - 2 * S)
      .lineTo(10 * S, y - 1 * S)
      .stroke({ width: 3 * S, color: palette.ink, cap: 'round' });
  } else if (job === 'woodsplitter') {
    g.rect(-7.5 * S, y - 5 * S, 15 * S, 3.5 * S)
      .fill(palette.headband)
      .stroke({ ...THIN_INK, width: 1.5 * S });
    g.moveTo(6 * S, y - 3 * S)
      .lineTo(10 * S, y + 2 * S)
      .stroke({ width: 2.5 * S, color: palette.headband, cap: 'round' });
  } else if (job === 'fisher') {
    // A wide oilskin hat, brim drooping at the back.
    g.moveTo(-6.5 * S, y - 3 * S)
      .arc(0, y - 3 * S, 6.5 * S, Math.PI, 0)
      .closePath()
      .fill(palette.oilskin)
      .stroke(INK);
    g.ellipse(0, y - 2 * S, 13 * S, 3.5 * S)
      .fill(palette.oilskin)
      .stroke(INK);
  } else if (job === 'hunter') {
    // A peaked cap with a long feather swept back.
    g.moveTo(-3 * S, y - 7 * S)
      .quadraticCurveTo(-12 * S, y - 16 * S, -18 * S, y - 13 * S)
      .stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
    g.moveTo(-3 * S, y - 7 * S)
      .quadraticCurveTo(-12 * S, y - 16 * S, -18 * S, y - 13 * S)
      .stroke({ width: 2.5 * S, color: palette.feather, cap: 'round' });
    g.poly([-9 * S, y - 2 * S, -3 * S, y - 10 * S, 7 * S, y - 8 * S, 12 * S, y - 1 * S])
      .fill(palette.hunterCap)
      .stroke(INK);
  } else if (job === 'farmer') {
    // A wide straw hat.
    g.ellipse(0, y - 1 * S, 13 * S, 3.5 * S)
      .fill(palette.thatch)
      .stroke(INK);
    g.ellipse(0, y - 4 * S, 6 * S, 4 * S)
      .fill(palette.thatch)
      .stroke(INK);
  } else if (job === 'watchman') {
    // An iron kettle helmet.
    g.moveTo(-7 * S, y - 2 * S)
      .arc(0, y - 2 * S, 7 * S, Math.PI, 0)
      .closePath()
      .fill(palette.axeHead)
      .stroke(INK);
    g.ellipse(0, y - 2 * S, 11 * S, 3 * S)
      .fill(palette.ironLight)
      .stroke(INK);
  }
}

/**
 * The tool a villager holds for its Job, drawn over its body: the woodcutter's axe on its shoulder,
 * the woodsplitter's maul, the fisher's rod, the forager's basket, the hunter's bow, the spade of
 * the forester, clay digger, bog digger, charcoal burner and brickmaker, the pick of the
 * quarryman, miner and stonecutter, the sawyer's saw, the farmer's scythe, the watchman's spear.
 * Carriers, smokers, smelters and brewers carry nothing but their pack. Hidden while the villager swings its axe at work.
 */
export function drawVillagerTool(g: Graphics, job: JobId): void {
  g.clear();
  const hx = HAND_X;
  const hy = HAND_Y;
  if (job === 'woodcutter') {
    pole(g, hx, hy + 2 * S, 9 * S, -48 * S, 2.5 * S, palette.log);
    g.poly([9 * S, -45 * S, 18 * S, -51 * S, 19 * S, -39 * S, 10 * S, -39 * S])
      .fill(palette.axeHead)
      .stroke(THIN_INK);
  } else if (job === 'woodsplitter') {
    // A maul resting on the shoulder: a heavy iron wedge on a thick haft.
    pole(g, hx, hy + 2 * S, 11 * S, -44 * S, 3 * S, palette.log);
    g.poly([6 * S, -50 * S, 16 * S, -50 * S, 16 * S, -41 * S, 6 * S, -41 * S])
      .fill(palette.iron)
      .stroke(THIN_INK);
  } else if (job === 'fisher') {
    pole(g, hx, hy + 3 * S, 26 * S, -72 * S, 1.8 * S, palette.log);
    g.moveTo(26 * S, -72 * S)
      .quadraticCurveTo(33 * S, -60 * S, 30 * S, -44 * S)
      .stroke({ width: 1 * S, color: palette.rope });
    g.circle(30 * S, -43 * S, 2.5 * S)
      .fill(palette.float)
      .stroke({ ...THIN_INK, width: 1.2 * S });
  } else if (job === 'forager') {
    // A basket on the arm, heaped with berries and a mushroom.
    const x = -hx - 2 * S;
    const y = hy + 4 * S;
    g.moveTo(x - 6 * S, y - 7 * S)
      .quadraticCurveTo(x, y - 18 * S, x + 6 * S, y - 7 * S)
      .stroke({ width: 4 * S, color: palette.ink, cap: 'round' });
    g.moveTo(x - 6 * S, y - 7 * S)
      .quadraticCurveTo(x, y - 18 * S, x + 6 * S, y - 7 * S)
      .stroke({ width: 2 * S, color: palette.basket, cap: 'round' });
    for (const dx of [-3, 1, 4]) {
      g.circle(x + dx * S, y - 8 * S, 2.4 * S)
        .fill(palette.berry)
        .stroke({ ...THIN_INK, width: 1 * S });
    }
    g.ellipse(x - 1 * S, y - 10 * S, 3.5 * S, 2.2 * S)
      .fill(palette.mushroomCap)
      .stroke({ ...THIN_INK, width: 1 * S });
    g.poly([x - 8 * S, y - 7 * S, x + 8 * S, y - 7 * S, x + 6 * S, y + 2 * S, x - 6 * S, y + 2 * S])
      .fill(palette.basket)
      .stroke(THIN_INK);
    g.moveTo(x - 7 * S, y - 3 * S)
      .lineTo(x + 7 * S, y - 3 * S)
      .stroke({ width: 1.2 * S, color: palette.basketDark });
  } else if (job === 'hunter') {
    // A longbow held upright in the left hand, its string on the near side.
    const x = -hx - 1 * S;
    g.moveTo(x, -46 * S)
      .quadraticCurveTo(x - 14 * S, hy, x, 0)
      .stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
    g.moveTo(x, -46 * S)
      .quadraticCurveTo(x - 14 * S, hy, x, 0)
      .stroke({ width: 2.5 * S, color: palette.log, cap: 'round' });
    g.moveTo(x, -46 * S)
      .lineTo(x, 0)
      .stroke({ width: 1 * S, color: palette.rope });
    g.circle(-hx, hy, 2.8 * S)
      .fill(palette.skin)
      .stroke({ ...THIN_INK, width: 1.5 * S });
  } else if (job === 'quarryman' || job === 'miner' || job === 'stonecutter') {
    // A pick on the shoulder, its iron head curving either way behind the head.
    pole(g, hx, hy + 2 * S, 10 * S, -50 * S, 2.5 * S, palette.log);
    g.moveTo(1 * S, -46 * S)
      .quadraticCurveTo(10 * S, -56 * S, 20 * S, -50 * S)
      .stroke({ width: 5 * S, color: palette.ink, cap: 'round' });
    g.moveTo(1 * S, -46 * S)
      .quadraticCurveTo(10 * S, -56 * S, 20 * S, -50 * S)
      .stroke({ width: 2.5 * S, color: palette.iron, cap: 'round' });
  } else if (
    job === 'forester' ||
    job === 'clay_digger' ||
    job === 'bog_digger' ||
    job === 'charcoal_burner' ||
    job === 'brickmaker'
  ) {
    // A spade on the shoulder, its blade up behind the head.
    pole(g, hx, hy + 2 * S, 12 * S, -50 * S, 2.5 * S, palette.log);
    g.poly([8 * S, -52 * S, 17 * S, -49 * S, 18 * S, -60 * S, 12 * S, -63 * S])
      .fill(palette.axeHead)
      .stroke(THIN_INK);
  } else if (job === 'sawyer') {
    // A frame saw on the shoulder: a toothed blade behind the head, its handle in the hand.
    pole(g, hx, hy + 2 * S, 8 * S, -50 * S, 2.5 * S, palette.log);
    g.poly([6 * S, -50 * S, 22 * S, -58 * S, 23 * S, -55 * S, 8 * S, -47 * S])
      .fill(palette.axeHead)
      .stroke(THIN_INK);
    for (let i = 0; i < 4; i++) {
      const tx = 10 * S + i * 3.5 * S;
      const ty = -47.5 * S - i * 1.8 * S;
      g.moveTo(tx, ty)
        .lineTo(tx + 1.5 * S, ty + 2 * S)
        .stroke({ width: 1 * S, color: palette.ink });
    }
  } else if (job === 'farmer') {
    // A scythe on the shoulder, its long blade curving down behind the head.
    pole(g, hx, hy + 2 * S, 6 * S, -56 * S, 2.5 * S, palette.log);
    g.moveTo(6 * S, -56 * S)
      .quadraticCurveTo(-8 * S, -60 * S, -16 * S, -48 * S)
      .stroke({ width: 4.5 * S, color: palette.ink, cap: 'round' });
    g.moveTo(6 * S, -56 * S)
      .quadraticCurveTo(-8 * S, -60 * S, -16 * S, -48 * S)
      .stroke({ width: 2 * S, color: palette.axeHead, cap: 'round' });
  } else if (job === 'watchman') {
    // A spear stood upright beside it, gripped in the right hand.
    pole(g, hx + 1 * S, 0, hx + 1 * S, -56 * S, 2.5 * S, palette.torchPole);
    const x = hx + 1 * S;
    g.poly([x, -68 * S, x + 3.5 * S, -59 * S, x, -54 * S, x - 3.5 * S, -59 * S])
      .fill(palette.axeHead)
      .stroke(THIN_INK);
    g.circle(hx, hy, 2.8 * S)
      .fill(palette.skin)
      .stroke({ ...THIN_INK, width: 1.5 * S });
  }
}

// The notice board: one a village, unlocked at Hamlet, and what's posted on it.
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { canPlaceBuilding } from '../src/grid';
import { createInitialState, type MapDef } from '../src/map';
import { noticeBoardOf, postings } from '../src/noticeBoard';
import { rankLock } from '../src/ranks';
import type { GameState } from '../src/state';
import { content, run, runUntil } from './helpers';

/** A meadow with logs on a Stockpile and two Carriers. */
const square: MapDef = {
  name: 'square',
  rows: Array.from({ length: 8 }, () => '..........'),
  buildings: [],
  stockpiles: [{ x: 0, y: 0, w: 2, h: 2, goods: [{ resource: 'logs', amount: 30 }] }],
  villagers: [
    { job: 'carrier', x: 0, y: 7 },
    { job: 'carrier', x: 1, y: 7 },
  ],
};

function camp(): GameState {
  return createInitialState(1, square, content);
}

function hamlet(): GameState {
  const s = camp();
  s.rank = 'hamlet';
  return s;
}

const place = (x: number, y: number): Command => ({
  type: 'placeBuilding',
  building: 'notice_board',
  x,
  y,
});

const boards = (s: GameState) =>
  [...Object.values(s.components.site), ...Object.values(s.components.building)].filter(
    (b) => b.type === 'notice_board',
  ).length;

describe('the notice board', () => {
  it('is a cheap 1×1 building, one a village', () => {
    const def = content.buildings.notice_board;
    expect(def.size).toEqual({ w: 1, h: 1 });
    expect(def.onePerVillage).toBe(true);
    expect(def.noticeBoard).toBe(true);
  });

  it("can't be placed before Hamlet", () => {
    const s = camp();
    expect(rankLock(s, content, 'notice_board')).toEqual({ kind: 'rank', rank: 'hamlet' });
    expect(canPlaceBuilding(s, content, 'notice_board', 5, 3)).toBe(false);
    expect(boards(run(s, 1, { 0: [place(5, 3)] }))).toBe(0);
  });

  it('can be placed at Hamlet, but only one', () => {
    const s = hamlet();
    expect(canPlaceBuilding(s, content, 'notice_board', 5, 3)).toBe(true);
    const one = run(s, 1, { 0: [place(5, 3), place(7, 3)] });
    expect(boards(one)).toBe(1);
    expect(canPlaceBuilding(one, content, 'notice_board', 7, 3)).toBe(false);
  });

  it('is built from logs and found once it stands, with nothing posted yet', () => {
    const s = run(hamlet(), 1, { 0: [place(5, 3)] });
    expect(noticeBoardOf(s, content)).toBeNull();
    const built = runUntil(s, (x) => noticeBoardOf(x, content) !== null, 2000);
    const id = noticeBoardOf(built, content);
    expect(id).not.toBeNull();
    expect(idsOf(built.components.building)).toContain(id);
    // A second can't be placed beside a finished one either.
    expect(canPlaceBuilding(built, content, 'notice_board', 7, 3)).toBe(false);
    // Nothing here makes goods, so no Delivery order is posted; Charters come with ticket 11.
    expect(postings(built, content)).toEqual([]);
  });
});

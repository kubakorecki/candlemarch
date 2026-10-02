// Charters (spec, Trades and masters: Charters in M5): from Hamlet the notice board posts up to 2
// at a time, each a named Master of a trade the village lacks, with conditions (a free place in a
// House, the workshop and what supplies it) and a fee. An offer is withdrawn after 10 days; that
// trade can come again later. Accepting, once every condition holds and the Treasury covers the
// fee, pays it and brings the Master in at the entry tile like a Newcomer.
import type { Content, TradeId } from '@candlemarch/content';
import { describe, expect, it } from 'vitest';
import { calendarAt, dawnTick } from '../src/calendar';
import type { Command } from '../src/commands';
import { idsOf } from '../src/entities';
import { createInitialState, type MapDef } from '../src/map';
import { masterOf, settleMaster } from '../src/masters';
import { type Posting, postings } from '../src/noticeBoard';
import { deserialize, serialize } from '../src/save';
import type { EntityId, GameState } from '../src/state';
import { villagerTile } from '../src/systems/movement';
import { COIN } from '../src/treasury';
import { content, run } from './helpers';

const DAY = content.calendar.dayTicks;

/**
 * 16×8 Meadow, the entry on the west edge at (0,4): a notice board 1 at (14,0), a Hut 2 at (8,0)
 * (3 places), a sawpit 3 at (2,0) with its sawyer 4 (waiting for a Carpenter), a woodcutter's hut
 * 5 at (5,0) with its woodcutter 6. They live in the Hut, which has one place left. No Granary, so
 * no Newcomer comes.
 */
const village: MapDef = {
  name: 'village',
  rows: Array.from({ length: 8 }, () => '................'),
  entry: { x: 0, y: 4 },
  buildings: [
    { type: 'notice_board', x: 14, y: 0 },
    { type: 'hut', x: 8, y: 0 },
    { type: 'sawpit', x: 2, y: 0 },
    { type: 'woodcutters_hut', x: 5, y: 0 },
  ],
  villagers: [],
};
const BOARD = 1;
const HUT = 2;
const SAWPIT = 3;
const VILLAGERS = [4, 6];
const WOODCUTTER = 6;

/** Content offering only the Charters of `trades`. */
function offering(...trades: TradeId[]): Content {
  const offers = Object.fromEntries(trades.map((t) => [t, content.charters.offers[t]]));
  return { ...content, charters: { ...content.charters, offers } };
}
const CARPENTER_AND_MASON = offering('carpenter', 'mason');
const CARPENTER = offering('carpenter');

function hamlet(map: MapDef = village): GameState {
  const s = createInitialState(1, map, content);
  s.rank = 'hamlet';
  s.treasury = 1000 * COIN;
  return s;
}

const charters = (s: GameState, c: Content = content): Posting[] =>
  postings(s, c).filter((p) => p.kind === 'charter');
const tradesUp = (s: GameState, c: Content = content): (TradeId | undefined)[] =>
  charters(s, c).map((p) => p.master?.trade);
const charterOf = (s: GameState, trade: TradeId, c: Content = content): Posting => {
  const p = charters(s, c).find((x) => x.master?.trade === trade);
  if (!p) throw new Error(`no ${trade} Charter up`);
  return p;
};
const accept = (posting: number): Command => ({ type: 'acceptPosting', posting });
/** A deep copy (state is plain data). */
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
const day = (s: GameState) => calendarAt(s.tick, content).day;

/** Runs `s` to the Dawn of `d` (the Dawn itself run too). */
function toDawn(s: GameState, d: number, c: Content = content): GameState {
  return run(s, dawnTick(d, content) - s.tick + 1, {}, c);
}

describe('Charters', () => {
  it('are posted from Hamlet at the first Dawn a notice board stands: two named Masters', () => {
    const s = run(hamlet(), 1);
    const up = charters(s);
    expect(up).toHaveLength(content.charters.max);
    expect(up).toHaveLength(2);
    const trades = up.map((p) => p.master?.trade);
    expect(new Set(trades).size).toBe(2);
    for (const p of up) {
      const trade = p.master?.trade;
      if (!trade) throw new Error('a Charter names its Master');
      expect(['carpenter', 'mason', 'butcher', 'brewer', 'smith']).toContain(trade);
      expect(content.villagerNames).toContain(p.master?.name);
      expect(p.coin).toBe(content.charters.offers[trade]?.fee);
      expect(p.endsAt).toBe(10 * DAY);
      expect(p.goods).toBeNull();
      expect(p.accepted).toBe(false);
    }
  });

  it("aren't posted at Camp, nor without a notice board", () => {
    const camp = hamlet();
    camp.rank = 'camp';
    expect(charters(run(camp, 1))).toEqual([]);
    const { buildings, ...rest } = village;
    const noBoard = hamlet({
      ...rest,
      buildings: buildings.filter((b) => b.type !== 'notice_board'),
    });
    expect(charters(run(noBoard, 1))).toEqual([]);
  });

  it('never offer a trade whose Master lives in the village', () => {
    const s = hamlet();
    settleMaster(s, WOODCUTTER, 'carpenter');
    expect(tradesUp(run(s, 1, {}, CARPENTER_AND_MASON), CARPENTER_AND_MASON)).toEqual(['mason']);
  });

  it('are withdrawn after 10 days, and that trade comes again later', () => {
    let s = run(hamlet(), 1, {}, CARPENTER);
    expect(tradesUp(s, CARPENTER)).toEqual(['carpenter']);
    s = toDawn(s, 10, CARPENTER);
    expect(tradesUp(s, CARPENTER)).toEqual(['carpenter']);
    s = toDawn(s, 11, CARPENTER);
    expect(day(s)).toBe(11);
    expect(charters(s, CARPENTER)).toEqual([]);
    s = toDawn(s, 11 + content.charters.againDays - 1, CARPENTER);
    expect(charters(s, CARPENTER)).toEqual([]);
    s = toDawn(s, 11 + content.charters.againDays, CARPENTER);
    const again = charters(s, CARPENTER);
    expect(again.map((p) => p.master?.trade)).toEqual(['carpenter']);
    expect(again[0]?.endsAt).toBe(dawnTick(21 + content.charters.againDays, content));
  });

  it('a withdrawn slot is filled at once by another trade', () => {
    const three = offering('carpenter', 'mason', 'smith');
    let s = run(hamlet(), 1, {}, three);
    const first = tradesUp(s, three);
    s = toDawn(s, 11, three);
    const next = tradesUp(s, three);
    expect(next).toHaveLength(1);
    expect(first).not.toContain(next[0]);
  });

  it('track their conditions: a free place in a House, the workshop and its supply', () => {
    const s = run(hamlet(), 1, {}, CARPENTER_AND_MASON);
    const carpenter = charterOf(s, 'carpenter', CARPENTER_AND_MASON);
    expect(carpenter.conditions).toEqual([
      { kind: 'housePlace', met: true },
      { kind: 'building', anyOf: ['sawpit'], met: true },
      { kind: 'building', anyOf: ['woodcutters_hut'], met: true },
    ]);
    expect(carpenter.canAccept).toBe(true);
    const mason = charterOf(s, 'mason', CARPENTER_AND_MASON);
    expect(mason.conditions).toEqual([
      { kind: 'housePlace', met: true },
      { kind: 'building', anyOf: ['stonecutter', 'brick_kiln'], met: false },
      { kind: 'building', anyOf: ['quarry'], met: false },
    ]);
    expect(mason.canAccept).toBe(false);

    // The Hut full: no free place for the Master.
    const full = clone(s);
    const extra = full.components.villager[WOODCUTTER];
    if (!extra) throw new Error('no woodcutter');
    full.components.villager[full.nextId] = { ...clone(extra), home: HUT };
    full.nextId += 1;
    const crowded = charterOf(full, 'carpenter', CARPENTER_AND_MASON);
    expect(crowded.conditions[0]).toEqual({ kind: 'housePlace', met: false });
    expect(crowded.canAccept).toBe(false);
  });

  it("can't be accepted before every condition holds, nor without the fee", () => {
    const s = run(hamlet(), 1, {}, CARPENTER_AND_MASON);
    const mason = charterOf(s, 'mason', CARPENTER_AND_MASON);
    const refused = run(s, 1, { 1: [accept(mason.id)] }, CARPENTER_AND_MASON);
    expect(refused.treasury).toBe(1000 * COIN);
    expect(idsOf(refused.components.villager)).toEqual(VILLAGERS);
    expect(tradesUp(refused, CARPENTER_AND_MASON)).toContain('mason');

    const poor = clone(s);
    poor.treasury = 99 * COIN;
    const carpenter = charterOf(poor, 'carpenter', CARPENTER_AND_MASON);
    expect(carpenter.canAccept).toBe(false);
    expect(carpenter.coinShort).toBe(true);
    const unpaid = run(poor, 1, { 1: [accept(carpenter.id)] }, CARPENTER_AND_MASON);
    expect(unpaid.treasury).toBe(99 * COIN);
    expect(idsOf(unpaid.components.villager)).toEqual(VILLAGERS);
  });

  it('accepted, pays the fee and brings the Master in at the entry, to their free place', () => {
    const s = run(hamlet(), 1, {}, CARPENTER_AND_MASON);
    const carpenter = charterOf(s, 'carpenter', CARPENTER_AND_MASON);
    const name = carpenter.master?.name;
    const next = run(s, 1, { 1: [accept(carpenter.id)] }, CARPENTER_AND_MASON);
    expect(next.treasury).toBe(900 * COIN);
    expect(tradesUp(next, CARPENTER_AND_MASON)).toEqual(['mason']);

    const master = idsOf(next.components.villager).find(
      (id) => !VILLAGERS.includes(id),
    ) as EntityId;
    const v = next.components.villager[master];
    expect(v?.name).toBe(name);
    expect(masterOf(next, master)).toBe('carpenter');
    expect(next.trades).toEqual(['carpenter']);
    expect(v?.home).toBe(HUT);
    expect(v?.routine).toBe('goingHome');
    expect(villagerTile(next, master)).toEqual({ x: 0, y: 4 });

    // Once home, staffing puts the Master to work in the sawpit.
    let x = next;
    for (let i = 0; i < 2000 && x.components.villager[master]?.workplace !== SAWPIT; i++) {
      x = run(x, 1, {}, CARPENTER_AND_MASON);
    }
    expect(x.components.villager[master]?.workplace).toBe(SAWPIT);
    // Accepting it again does nothing: it's down.
    const again = run(next, 1, { 2: [accept(carpenter.id)] }, CARPENTER_AND_MASON);
    expect(again.treasury).toBe(900 * COIN);
    expect(idsOf(again.components.villager)).toHaveLength(3);
  });

  it('is deterministic, and a save mid-run plays on the same', () => {
    const c = CARPENTER_AND_MASON;
    const carpenter = charterOf(run(hamlet(), 1, {}, c), 'carpenter', c).id;
    const commands = { 30: [accept(carpenter)] };
    // Two days: nobody here eats, so the village starves on the third.
    const a = run(hamlet(), 2 * DAY, commands, c);
    expect(idsOf(a.components.villager)).toHaveLength(3);
    expect(a).toEqual(run(hamlet(), 2 * DAY, commands, c));
    const mid = run(hamlet(), DAY + 100, commands, c);
    const rest = DAY - 100;
    expect(run(deserialize(serialize(mid), c), rest, {}, c)).toEqual(run(mid, rest, {}, c));
    // The notice board itself is what posts them.
    expect(a.components.building[BOARD]?.type).toBe('notice_board');
  });
});

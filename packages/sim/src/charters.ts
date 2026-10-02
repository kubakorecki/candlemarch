// Charters (spec, Trades and masters: Charters in M5): a Master's offer on the notice board to
// settle in the village. From the rank that opens a trade's Charter (`unlocks.charters`), and while
// a notice board stands, each Dawn fills the board up to `charters.max` with offers drawn with the
// PRNG among the trades the village lacks (no Master of it lives here), not up already and not
// withdrawn too lately (`systems/charters.ts`). An offer is withdrawn `days` after it's posted;
// that trade may come again `againDays` later. Accepting needs a free place in a House, the
// buildings the trade's content asks for, and the fee in the Treasury: it pays the fee, and the
// Master arrives at the entry tile like a Newcomer and walks to their free place.
import type { BuildingId, Content, TradeId } from '@candlemarch/content';
import { calendarAt } from './calendar';
import { idsOf } from './entities';
import { homeDoor, nearestHouseWithRoom } from './homes';
import { hasMaster, settleMaster } from './masters';
import type { PostingCondition } from './noticeBoard';
import { randomInt } from './rng';
import type { CharterOffer, EntityId, GameState } from './state';
import { walkTo } from './systems/movement';
import { canAfford, spendCoin } from './treasury';
import { drawVillagerName, spawnVillager } from './villagers';

/** The trades whose Charters the village's rank has opened, in rank then content order. */
function openedTrades(state: GameState, content: Content): TradeId[] {
  const opened: TradeId[] = [];
  for (const rank of content.ranks) {
    opened.push(...rank.unlocks.charters);
    if (rank.id === state.rank) break;
  }
  return opened.filter((t) => content.charters.offers[t] !== undefined);
}

/** The House a Master arriving now would live in, or null: no entry, or no free place in reach. */
function masterHome(state: GameState, content: Content): EntityId | null {
  const { entry } = state.map;
  return entry === null ? null : nearestHouseWithRoom(state, content, entry);
}

/** Whether a finished building of one of `types` stands. */
function stands(state: GameState, types: readonly BuildingId[]): boolean {
  const { building } = state.components;
  return idsOf(building).some((id) => {
    const b = building[id];
    return b !== undefined && types.includes(b.type);
  });
}

/** What `trade`'s Charter asks for, each with whether it holds now. */
export function charterConditions(
  state: GameState,
  content: Content,
  trade: TradeId,
): PostingCondition[] {
  const asks = content.charters.offers[trade]?.buildings ?? [];
  return [
    { kind: 'housePlace', met: masterHome(state, content) !== null },
    ...asks.map(
      (anyOf): PostingCondition => ({ kind: 'building', anyOf, met: stands(state, anyOf) }),
    ),
  ];
}

/** `trade`'s fee in whole coins (0 without an offer in content). */
export function charterFee(content: Content, trade: TradeId): number {
  return content.charters.offers[trade]?.fee ?? 0;
}

/** Withdraws the Charters whose time is up; their trades may come again `againDays` from today. */
export function withdrawCharters(state: GameState, content: Content): void {
  const board = state.noticeBoard;
  const today = calendarAt(state.tick, content).day;
  for (const charter of board.charters) {
    if (state.tick >= charter.endsAt) {
      board.chartersAgain[charter.trade] = today + content.charters.againDays;
    }
  }
  board.charters = board.charters.filter((c) => state.tick < c.endsAt);
}

/**
 * Fills the board up to `charters.max`: each offer a trade drawn with the PRNG among those opened,
 * without a Master living here, not up already and not withdrawn too lately, and a name drawn.
 */
export function postCharters(state: GameState, content: Content): void {
  const board = state.noticeBoard;
  const today = calendarAt(state.tick, content).day;
  while (board.charters.length < content.charters.max) {
    const offered = openedTrades(state, content).filter(
      (t) =>
        !hasMaster(state, t) &&
        !board.charters.some((c) => c.trade === t) &&
        (board.chartersAgain[t] ?? 0) <= today,
    );
    if (offered.length === 0) return;
    const trade = offered[randomInt(state, offered.length)];
    if (trade === undefined) return;
    board.charters.push({
      id: board.nextPostingId,
      trade,
      name: drawVillagerName(state, content),
      endsAt: state.tick + content.charters.days * content.calendar.dayTicks,
    });
    board.nextPostingId += 1;
  }
}

/**
 * Accepts Charter `id` if it's up and can be accepted: pays the fee, takes it down, and brings its
 * Master in at the entry tile with a Home in the nearest House with room, walking there.
 */
export function acceptCharter(state: GameState, content: Content, id: number): void {
  const board = state.noticeBoard;
  const charter = board.charters.find((c) => c.id === id);
  const { entry } = state.map;
  if (!charter || entry === null || !charterStatus(state, content, charter).canAccept) return;
  const home = masterHome(state, content);
  if (home === null || !spendCoin(state, charterFee(content, charter.trade))) return;
  board.charters = board.charters.filter((c) => c.id !== id);

  const master = spawnVillager(state, content, 'carrier', entry, null, charter.name);
  const v = state.components.villager[master];
  if (!v) return;
  settleMaster(state, master, charter.trade);
  v.home = home;
  const door = homeDoor(state, content, master);
  if (door !== null) walkTo(state, content, master, [door]);
  v.routine = state.components.path[master] ? 'goingHome' : 'work';
}

/**
 * Charter `charter`'s conditions now, whether the Treasury is short of its fee, and so whether it
 * can be accepted (every condition holds and the fee is covered).
 */
export function charterStatus(
  state: GameState,
  content: Content,
  charter: CharterOffer,
): { conditions: PostingCondition[]; canAccept: boolean; coinShort: boolean } {
  const conditions = charterConditions(state, content, charter.trade);
  const coinShort = !canAfford(state, charterFee(content, charter.trade));
  return { conditions, canAccept: conditions.every((c) => c.met) && !coinShort, coinShort };
}

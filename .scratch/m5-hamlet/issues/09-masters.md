# Masters

Status: resolved
Type: task
Blocked by: 01, 04, m2-camp-winter/06

## What

Spec: Trades and masters (What a master is, How a trade scales). Glossary: Master.

- Content: the 7 master trades (Carpenter, Mason, Butcher, Smith, Miller, Brewer, Baker) and which workshops each runs.
- A Master is an ordinary villager with a trade: same needs, Home, death. An icon marks them over their head and in panels.
- A trade's workshops can be built (Hamlet) before its Master comes but stand idle ("Waiting for a Master") until the Master settles.
- The Master works in a workshop of their trade (the first one built, if several) at +50% speed; other workshops of the trade work at normal speed with ordinary villagers.
- If the Master dies or leaves, every workshop of the trade works at 25% until a new Master comes. A trade that never had a Master stays idle.
- How Masters arrive is ticket 11; tests can put a Master straight into state.

## Done when

- Headless tests: a workshop idles without its Master; the Master's workshop is +50%; another workshop runs at normal speed; losing the Master drops both to 25%.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. Trades are content (`trades.ts`, `BuildingDef.trade` on a workshop; none yet, ticket 12 adds them); a Master is a `master` component on a villager, `state.trades` remembers every trade that has had one. Workshops of a trade never Mastered stand idle, unstaffed, asking for no inputs ("Waiting for a Master: the Carpenter"); the Master works in the lowest-ID workshop of the trade at 150%, the others at 100%, and all crawl at 25% once the Master is gone. `settleMaster` puts a Master into state (tests; Charters in ticket 11). The Master shows a gilt star over the head and on avatars, and "Master Carpenter" in the villager panel and worker rows. Tests: `packages/sim/test/masters.test.ts`. See docs/decisions.md.

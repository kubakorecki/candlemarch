# Hero fights and gets knocked out

Status: resolved
Type: task
Blocked by: 04

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Hero). Numbers Proposed, all in content.

- The Hero has 100 HP and hits for 10 every 20 ticks. It fights Gloamlings in reach on its own and can be ordered to attack one (a new hero order).
- At 0 HP it is **Knocked out** where it falls for 400 ticks: no orders, no aura, and Gloamlings ignore it. Then it gets up at full HP. (The village hall in M5 becomes where it recovers.)
- Client: knocked-out pose or icon, a countdown in the hero panel, attack cursor on a Gloamling.

## Done when

- Headless tests: the Hero kills a Gloamling; an ordered attack; knockout at 0 HP, Gloamlings retarget, recovery on schedule at full HP; save/load while Knocked out.
- `pnpm check` passes.

## Comments

2026-09-28 — Design session 01: no longer blocked by `m1-5-hero-playtest/04`. That playtest is about hauling and the aura, not fighting.

2026-09-28 — Done. `content.combat.hero` holds the numbers; `hero.hp`, `readyAt`, `knockedOutUntil` in state (old saves backfill). The Hero hits any Gloamling in reach (its ordered target first), alongside its current order, and like villagers is back to full HP at Dawn (not in the issue; logged in `docs/decisions.md`). New order `attack` (right-click a Gloamling). Knocked out: order dropped, walk ends at the next tile, no orders, no aura, ignored by Gloamlings, up at full HP 400 ticks later. Client: fallen pose with circling stars, "Knocked out, up in N s" in the readout (the hero has no panel of its own), crosshair cursor over a Gloamling while the hero is selected.

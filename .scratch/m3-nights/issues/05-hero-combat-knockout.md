# Hero fights and gets knocked out

Status: ready-for-agent
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

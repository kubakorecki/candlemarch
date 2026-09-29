# Reserves: Forest the woodcutters leave alone

Status: ready-for-agent
Type: task
Blocked by: 03, m2-camp-winter/08

## What

Rules in `docs/spec.md`, World and map ("Forest ecology", Reserve).

- A **Reserve** is a set of tiles the player paints and erases like a Dirt path: free and instant, with new commands for both.
- Woodcutters never fell a tree on a Reserve tile. Foragers, hunters and foresters work in it as usual. That's the whole "logged or foraged, never both" rule: foraging never harms trees.
- A Reserve doesn't block building.
- Client: a Reserve paint tool and overlay. The woodcutter's hut placement preview shows Reserve tiles in its radius.

## Done when

- Headless tests: a woodcutter skips trees in a Reserve and fells the nearest one outside it; painting and erasing; save/load keeps Reserves.
- `pnpm check` passes.

## Comments

2026-09-27 — M2 design session (m2-camp-winter/01): foraging now uses Forage patches (berry bushes, mushroom patches) as map objects, not trees, and a patch refills only with a standing tree within 2 tiles. Reconcile the "logged or foraged tile" rule with that shade rule here.

2026-09-29 — Design session 03: reconciled. The player paints a Reserve where woodcutters don't fell; the shade rule stays as it is. Foragers get no restriction.

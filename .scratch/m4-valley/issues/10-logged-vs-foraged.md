# Logged vs foraged forest

Status: needs-info
Type: task
Blocked by: 03, m2-camp-winter/08

## What

- A forest tile is either logged or foraged, never both. Woodcutters skip foraged tiles; foragers skip logged ones.

## Open questions (design session 03, Q7)

- How tiles get their use (painted reserve or last use).

## Done when

- Headless tests: a woodcutter never fells in a foraging area and vice versa.
- `pnpm check` passes.

## Comments

2026-09-27 — M2 design session (m2-camp-winter/01): foraging now uses Forage patches (berry bushes, mushroom patches) as map objects, not trees, and a patch refills only with a standing tree within 2 tiles. Reconcile the "logged or foraged tile" rule with that shade rule here.

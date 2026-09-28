# Clearing Dens by day

Status: ready-for-agent
Type: task
Blocked by: 04, 05

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Clearing a Den). Numbers Proposed, all in content.

- The Hero can be ordered to attack a Den. A Den has 80 HP and stings anything adjacent for 5 every 20 ticks.
- At 0 HP the Den is removed and leaves a cache of 4 hides and 6 firewood on its tile, which the Hero or Carriers can pick up (a loose pile, the same shape as goods on a Stockpile tile, or whatever is simplest; log the choice).
- **Calm:** no Den buds within 15 tiles of a cleared Den for 10 days. One small record per cleared Den in state, dropped when it expires.
- Hero only in M3. Sending the militia at a Den is a later option.

## Done when

- Headless tests: clearing removes the Den, leaves the cache and stops its spawns; the sting can knock the Hero out; no budding inside the calm area until it expires; save/load mid-fight.
- `pnpm check` passes.

## Comments

2026-09-28 — Design session 01: Hero only, so no longer blocked by 07.

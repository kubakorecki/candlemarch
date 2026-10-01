# Charcoal kiln

Status: resolved
Type: task
Blocked by: m2-camp-winter/06, 04

## What

- Content: resource `charcoal` (stockpile); building `charcoal_kiln` (no master, unlocked at Hamlet) with recipe logs → charcoal.
- Uses the M2 recipe system.

## Done when

- Headless test: the kiln turns delivered logs into charcoal.
- `pnpm check` passes.

## Comments

2026-10-01 — Done. Content: `charcoal` (Stockpile, standing order 30), recipe `burn_charcoal` (3 logs → 2 charcoal, 200 ticks), Job `charcoal_burner`, building `charcoal_kiln` (Hamlet, 1×1, 6 logs + 4 stone, input buffer 6 logs). No new sim code: the recipe system runs it. Client: a domed clay kiln with smoke, charcoal pieces and icons, in the Workshops tab. Test: `sim/test/charcoalKiln.test.ts`. See `docs/decisions.md`.


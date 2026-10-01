# Workers help carry

Status: resolved
Type: task
Blocked by: none

## What

Spec: Logistics (Where goods are kept: Helping carry). Glossary: Carrier (helping carry).

- A worker whose Workplace can't use them right now (its yard is full, or it's a workshop waiting for inputs) takes Hauls as a Carrier: from their own Workplace's yard first, then any.
- After each Haul they check whether their Workplace can use them again, and go back to work if so.
- Their Job doesn't change; the villager panel says "helping carry". The building's "Output full" / "Waiting for X" icon still shows. Carrier utilization counts them only while they hold a Haul, like any Carrier.
- Ticket 17 adds "paused by its standing order" as a third case.

## Done when

- Headless tests: a gatherer with a full yard hauls its own output to a Stockpile and goes back to work; a workshop waiting for inputs lends its worker; determinism.
- Balance scenarios re-run; changes logged in `docs/decisions.md`.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. `logistics/helping.ts` (`canHelpCarry`, `cantUseWorkers`) decides when a worker is lent; `updateHauls` dispatches it from its own yard first, then any; `isHelpingCarry` (a worker holding a Haul) is what work systems skip, what traffic counts as a Carrier, and what the villager panel shows ("· helping carry" on its sub-line). Tests in `sim/test/helpingCarry.test.ts`; production and spoilage tests adjusted where an idle woodsplitter or fisher now carries. A helper carries a Carrier's load (1), not its Job's. Balance scenarios re-run and logged in `docs/decisions.md`. Not looked at in the browser.

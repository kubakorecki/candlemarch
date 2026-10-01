# Workers help carry

Status: ready-for-agent
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

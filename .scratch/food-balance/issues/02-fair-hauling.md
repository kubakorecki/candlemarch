# No Stockpile good starves another; gatherer stalls show

Status: ready-for-agent
Type: task
Blocked by: 01

## What

- Carriers serve Stockpile demand by priority and then resource in content order (`demandGroups`), so a steady log supply keeps hides at a hunter's lodge forever and the hunter stops. Within one Stockpile priority, serve resources fairly (e.g. a round-robin cursor in `state.logistics`, plain data, defaulted for old saves).
- `workplaceStatus` reports `outputFull` for gathering Workplaces (woodcutter, forager, hunter, fisher) whose output buffer can't take their next yield, so the client's output-full icon shows over a stalled lodge.

## Done when

- Headless test: a woodcutter and a hunter's lodge with one Carrier; hides reach the Stockpile within a day and the hunter keeps hunting.
- Headless test: a gatherer with a full buffer reports `outputFull`.
- Balance scenarios rerun; changes noted in `docs/decisions.md`.
- `pnpm check` passes.

## Comments

# Notice board

Status: ready-for-agent
Type: task
Blocked by: 01, 04

## What

Spec: Trades and masters (Notice board). Glossary: Notice board.

- Building `notice_board`: 1×1, cheap, one per village, unlocked at Hamlet.
- A React panel (Vellum design system) listing what's posted: Charters (ticket 11) and Delivery orders (ticket 26). Each entry shows its conditions met and unmet, its fee or reward, how long it stays up, and an Accept button when every condition holds.
- This ticket builds the board and an empty panel with the list shape; tickets 11 and 26 fill it.

## Done when

- Headless test: only one notice board can be placed; it can't be placed before Hamlet.
- The panel shows live posting state from the sim.
- `pnpm check` passes.

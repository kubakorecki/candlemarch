# Master traits

Status: needs-info
Type: task
Blocked by: 01, 02, m5-hamlet/09

## What

- Each master rolls 1–2 traits from a content pool with the seeded PRNG: Drunkard, Proud, Early riser, Pious, …
- Effects hook into existing systems (work speed near a tavern, quitting when a second master of the trade is invited, longer days, shrine happiness).
- The villager panel shows traits and what they do.

## Open questions (design session 01, Q8)

- The pool and the numbers.

## Done when

- A headless test per trait effect; deterministic rolls.
- `pnpm check` passes.

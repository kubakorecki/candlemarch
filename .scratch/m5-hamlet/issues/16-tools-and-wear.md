# Tools and wear

Status: needs-info
Type: task
Blocked by: 02, 15

## What

The spec's Proposed default, built so it's easy to change after the revisit:

- Gatherers and craftspeople need a tool for full speed; without one they work at half speed (no hard lock).
- Tools wear out after about a year of use (content number).
- Until the smithy (M6), tools come from imports.

## Open questions (design session 02, Q5)

- One good or several; how workers get tools; wear model.

## Done when

- Headless tests: half speed without a tool, full with one, a tool wears out on schedule.
- `pnpm check` passes.

# Hero fights and gets knocked out

Status: needs-info
Type: task
Blocked by: 04, m1-5-hero-playtest/04

## What

- The hero fights automatically when monsters are in range and can be ordered to attack.
- The hero can't die: at zero health it is knocked out, recovers after a while, and is out of action meanwhile.

## Open questions

- Hero strength and knockout duration (design session 01, Q8).
- How combat fits the hero's role (hero playtest).

## Done when

- Headless tests: the hero kills a monster; knockout and recovery on schedule.
- `pnpm check` passes.

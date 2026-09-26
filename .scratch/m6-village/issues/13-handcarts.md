# Handcarts

Status: needs-info
Type: task
Blocked by: 01, m1-roads-logistics/11

## What

- Unlocked at Village: carriers carry more per trip (logistics stage 4).

## Open questions

- How handcarts are made and assigned, capacity, and road-only or not (design session 01, Q10). Under job dispatch (ADR-0001) a handcart raises the amount per Haul; if road-only, dispatch needs a route that stays on roads.

## Done when

- Headless test: a carrier with a handcart moves more per trip.
- `pnpm check` passes.

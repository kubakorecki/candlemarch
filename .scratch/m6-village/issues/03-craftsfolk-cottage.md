# Craftsfolk tier and the cottage

Status: needs-info
Type: task
Blocked by: 01, 02, 06

## What

- Needs tiers: Settlers (food, shelter, warmth) and Craftsfolk (two kinds of food, ale at a tavern, furniture).
- When a hut's residents meet the Craftsfolk needs, the hut upgrades to a cottage; it falls back if needs lapse (as decided).
- The house panel shows each need and whether it's met.

## Open questions (design session 01, Q1, Q3)

- Upgrade and downgrade rules; furniture use.

## Done when

- Headless tests: upgrade when needs hold, downgrade when they lapse.
- `pnpm check` passes.

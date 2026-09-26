# Cobblestone roads

Status: needs-info
Type: task
Blocked by: 01, m1-roads-logistics/11, m5-hamlet/12

## What

- A second road type, unlocked at Village: costs cut stone, needs building, faster than a dirt path.
- Upgrade an existing dirt path in place.

## Open questions

- Cost and speed (design session 01, Q10). Logistics interaction is settled by ADR-0001: job dispatch measures nearness by walking cost, so a faster road draws Hauls onto it with no extra rule.

## Done when

- Headless tests: upgrading a path, faster walking on cobblestone.
- `pnpm check` passes.

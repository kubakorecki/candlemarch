# Forager's hut

Status: ready-for-agent
Type: task
Blocked by: 02, 07, m1-roads-logistics/06

## What

- Content: resources `berries`, `mushrooms` (food). Building `foragers_hut` with a forager worker and a work radius.
- The forager gathers from **standing** trees in the radius without felling them.
- Seasonal yield from content: berries peak in summer, mushrooms in autumn, nothing in winter.
- Output buffer supplies the granary (ticket 11); until then, output just fills.

## Done when

- Headless tests: gathers without removing trees, yields follow the season, nothing in winter.
- `pnpm check` passes.

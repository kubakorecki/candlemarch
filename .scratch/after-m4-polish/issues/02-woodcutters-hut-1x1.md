# Woodcutter's hut is 1×1

Status: resolved
Type: task
Blocked by:

## What

The woodcutter's hut becomes 1×1 with its door south, like the other gathering huts (owner). Content size/door, its placeholder art (drawn for 1×1 on all four turns), hand-made maps and balance scenarios that place one (check each still places and that `camp`, `valley` results hold or are re-logged).

## Done when

- Headless test: a 1×1 woodcutter's hut places, turns and works.
- `pnpm check` passes; scenario changes noted in `docs/decisions.md`.

## Comments

- 2026-09-30 — Done: content 1×1, door (0,1); `woodcutting.test.ts` places one on each turn, checks its tile and door, and runs it until it has logs. Hand-made maps and affected test maps move the hut so its door keeps its tile; balance scripts unchanged, all scenarios hold (numbers in `docs/decisions.md`). Art redrawn to 1×1 proportions on all four turns; the doorstep on north/west turns is the shared one issue 04 reworks.

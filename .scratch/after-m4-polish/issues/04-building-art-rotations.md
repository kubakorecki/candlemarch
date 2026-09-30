# Building art fits on every turn

Status: ready-for-agent
Type: task
Blocked by: 02, 03

## What

Doors and windows float off the walls (owner's screenshot: the woodcutter's hut and the Hut). Check every building's placeholder art on all four turns and fix it so doors, windows and trim sit on the walls they belong to, and the door drawn is where the sim's door tile is.

## Done when

- Every placeable building checked on turns 0–3 in the running client (screenshots are possible: Playwright's Chromium is installed in `~/Library/Caches/ms-playwright`; drive `pnpm dev` with a scratch script), and the fixes confirmed the same way.
- A unit test pins what can be pinned (e.g. the drawn door side follows `doorTile` for each turn).
- `pnpm check` passes.

## Comments

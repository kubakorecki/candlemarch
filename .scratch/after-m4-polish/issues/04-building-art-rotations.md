# Building art fits on every turn

Status: resolved
Type: task
Blocked by: 02, 03

## What

Doors and windows float off the walls (owner's screenshot: the woodcutter's hut and the Hut). Check every building's placeholder art on all four turns and fix it so doors, windows and trim sit on the walls they belong to, and the door drawn is where the sim's door tile is.

## Done when

- Every placeable building checked on turns 0–3 in the running client (screenshots are possible: Playwright's Chromium is installed in `~/Library/Caches/ms-playwright`; drive `pnpm dev` with a scratch script), and the fixes confirmed the same way.
- A unit test pins what can be pinned (e.g. the drawn door side follows `doorTile` for each turn).
- `pnpm check` passes.

## Comments

- 2026-09-30 — Checked every placeable building (Hut, woodcutter's, forager's and fisher's huts, hunter's and forester's lodges, Granary, chopping block, torch, brazier, bell, watchtower; palisades and gates, which don't turn) on turns 0–3 in the running client. Front (south/east) doors, windows and props already sat on their walls; the floating pieces were the back-door doorstep and small door drawn over the building for north/west doors. Those are gone: a back door isn't drawn (its wall can't be seen); every building now lays a doorstep and stepping stones across its door tile under its walls (`doorway(layout)` in shapes.ts, pinned for every building and turn in `client/test/rotation.test.ts`), and the watchtower has a ladder on its door's side. The forager's baskets and hunter's hide frame stay on their own tile beside the yard on every turn. A back door's stones can be hidden behind a big building (the Granary turned twice); logged in docs/decisions.md.

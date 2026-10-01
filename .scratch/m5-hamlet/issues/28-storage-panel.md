# Storage shown in the panel

Status: resolved
Type: task
Blocked by: none

## What

Spec: Logistics (Where goods are kept: Storage). Glossary: Storage.

- The Granary's Food is its Storage: it's no longer drawn as a pile beside the door (`GRANARY_PILE_MAX` in `client/src/render/WorldRenderer.ts` goes).
- Selecting a Granary lists everything in its Storage, a line per Food with its amount, and the total against its capacity.
- Build the panel part so the trade post (ticket 14) reuses it.

## Done when

- Selecting a Granary shows what it holds, live; no pile is drawn by its door.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. The sim says what a building keeps (`storageOf` in `sim/src/storage.ts`, a Granary's Food for now; the trade post adds its case there), `BuildingInfo.storage` carries it, and the building panel's `StorageFacts` shows it (total against capacity, a meter, a line per good held), live with the panel. A Granary can now be clicked into the panel (it had no panel: only buildings with workers did). The Granary's pile by its door is gone (`GRANARY_PILE_MAX`, `granaryPile`, and `drawBuilding`'s `stock`). Checked by typecheck and the sim test; not looked at in the browser.

# Storage shown in the panel

Status: ready-for-agent
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

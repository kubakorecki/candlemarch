# Recipes, workshop buffers and the chopping block

Status: resolved
Type: task
Blocked by: 07

## What

The generic production system all workshops will use, and its first building.

- Content `recipes`: inputs, outputs, work ticks. Buildings list the recipes they offer, and have input and output buffers (a few units each).
- A worker takes inputs from the input buffer, works (through `workTicks`, so the hero's aura applies), and puts outputs in the output buffer; it waits when inputs are missing or the output buffer is full.
- Input buffers become demands; output buffers become supplies (`listDemands` / `listSupplies`).
- Log priority in dispatch: construction sites first, then workshop input buffers, then Stockpiles.
- First building: **Chopping block** (spec, Firewood). 1×1, cheap in logs, placeable, employs one `woodsplitter`. Recipe: 1 log → 2 firewood. Resource `firewood` is stored on Stockpiles.
- The chopping block pauses (doesn't start new work, and its input buffer stops being a demand) while the village's firewood is at or above `firewoodTarget` in content (default 40), counting Stockpiles and, once ticket 14 lands, House buffers. Not editable yet; standing orders (M5) will make it so.
- The woodcutter's hut is unchanged: it only fells.
- Content validation covers recipe references.

## Done when

- Headless tests: a recipe runs, waits for inputs, waits on a full output, demand and supply appear; sites get logs before the chopping block, the chopping block before Stockpiles; the chopping block pauses at the target and resumes below it; determinism, save/load.
- `pnpm check` passes.

## Comments

2026-09-27 — Done in `63efd85` (content, sim, client: add recipes, workshop buffers and the chopping block); the hero can feed workshops since `e8a6b22`. Went ahead of its blocker 07: Stockpiles already took any resource, one per tile, so firewood stores without 07's `storage` field, which only turns Food away (logged in `docs/decisions.md`).

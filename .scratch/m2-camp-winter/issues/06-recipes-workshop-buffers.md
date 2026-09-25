# Recipes and workshop buffers

Status: needs-info
Type: task
Blocked by: 01

## What

The generic production system all workshops will use.

- Content `recipes`: inputs, outputs, work ticks. Buildings list the recipes they offer, and have input and output buffers (a few units each).
- A worker takes inputs from the input buffer, works, and puts outputs in the output buffer; it waits when inputs are missing or the output buffer is full.
- Input buffers become demands; output buffers become supplies (`listDemands` / `listSupplies`).
- First recipe: logs → firewood at the woodcutter's hut. Content validation covers recipe references.

## Open questions (design session 01, Q8)

- How the woodcutter's hut chooses between felling and splitting.

## Done when

- Headless tests: a recipe runs, waits for inputs, waits on a full output, demand and supply appear; determinism, save/load.
- `pnpm check` passes.

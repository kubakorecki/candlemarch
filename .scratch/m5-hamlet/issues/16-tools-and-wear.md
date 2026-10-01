# Tools and wear

Status: ready-for-agent
Type: task
Blocked by: 02, 15

## What

Spec: Economy (Tools: used and sold). Built so ticket 22 can change the wear rate or drop wear.

- Resource `tools` (Stockpile). Until the M6 smithy, tools come from imports and Ruins Caches.
- A Workplace asks for one tool per worker; Carriers deliver it like an input. A worker holding a tool works 50% faster (chop, catch, batch); walking is unchanged. Without one, today's speed.
- Some outputs need tools, a field per output in content. M5's only case: a hunter without a tool brings meat and no hides.
- A tool wears out after about a year of days worked (content number), then is gone.

## Done when

- Headless tests: a worker with a tool works faster; a hunter without one brings no hides; a tool wears out on schedule; a Workplace asks for a replacement.
- `pnpm check` passes.

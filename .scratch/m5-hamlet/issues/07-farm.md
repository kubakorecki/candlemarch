# Farm, Fields and grain

Status: ready-for-agent
Type: task
Blocked by: 02, 04, m2-camp-winter/02

## What

Spec: Resources (Farms and crops). Glossary: Field, Crop, Fieldstone.

- Content: resource `grain`, a Food (eaten as it is, kept in the Granary, slow to spoil). Building `farm` (Hamlet, no master) with farmers.
- **Fields:** the player paints and erases Field tiles on Meadow in a farm's radius, like a Reserve (free, instant, Revealed tiles only). The farm's panel holds the tool.
- **The year:** farmers sow Fields in spring; a Field grows for about a season; harvest runs from late summer through autumn, one harvest per Field a year; anything unharvested when winter starts is lost; nothing happens in winter.
- **Crop choice:** the farm's panel has a Crop picker; a change applies at the next spring sowing. Only grain exists until ticket 25 adds turnips.
- **Fieldstones:** at the start of each spring about 1 in 4 Field tiles (seeded PRNG) throws up a stone; farmers clear it before sowing that tile, and it goes to the farm's yard as `stone`.
- Grain counts as Food for Meals, the immigration rule and the Food alerts.

## Done when

- Headless tests: a year of sowing, growth and harvest; nothing in winter; unharvested grain is lost at winter; fieldstones appear in spring and leave as stone; villagers eat grain; determinism.
- `pnpm check` passes.

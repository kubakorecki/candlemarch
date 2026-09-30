# Choose a Hunting ground per lodge; outlines on select

Status: ready-for-agent
Type: task
Blocked by: 02

## What

From the playtest: hunters overhunt one ground, and the always-on ground outlines are intrusive.

- Sim: a hunter's lodge keeps a chosen Hunting ground (or none: the nearest with Game, as now). Command `setHuntingGround { building, ground }`, accepted only for a ground in reach. Its hunter hunts only there; when it's empty the hunter waits and `workplaceStatus` says why.
- Client: the lodge panel lists the grounds in reach (Game, health word) and "Nearest" (Vellum design system). Ground outlines and names show only while a hunter's lodge is selected or being placed, and in the woodcutter's hut preview's overlap warning.

## Done when

- Headless tests: the command (accepted / refused), a hunter keeping to its ground when another is fuller, save/load keeps the choice.
- `pnpm check` passes.

## Comments

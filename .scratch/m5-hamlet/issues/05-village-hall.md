# Village hall

Status: resolved
Type: task
Blocked by: 04, 06

## What

- The Hamlet rank building: logs and stone, placed once the village has 10 residents (numbers from content; tune later).
- Where the Hero recovers after a knockout: a Knocked-out Hero gets up at the village hall's door once it stands (spec: Heroes; Nights in v1).

## Done when

- Headless tests: a village with 10 residents builds the hall and becomes a Hamlet; with the hall standing, a Knocked-out Hero recovers there.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. The hall itself (content, Hamlet's rank building, 3×2, 40 logs + 20 stone, one a village, 10 residents, all from content) and its "10 residents build it and become a Hamlet" test came with ticket 04 (`sim/test/ranks.test.ts`); numbers left as they were (Proposed). This ticket adds the recovery: content `heroRecovers` on the hall, `recoveryTile` in `sim/hero.ts`, and the combat system moving the Hero to the hall's door when it gets up (tests in `sim/test/combat.test.ts`: up where it fell with no hall, up at the door with one). The Hero lies where it fell until then. Client: its own art (stone plinth, log walls, tall shingle gable, windows, banner), the knockout countdown says "up at the hall", and the jump isn't slid. Not looked at in the browser.

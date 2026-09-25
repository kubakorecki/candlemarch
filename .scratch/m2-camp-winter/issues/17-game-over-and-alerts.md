# Game over and death-spiral alerts

Status: needs-info
Type: task
Blocked by: 01, 14, 15

## What

- Game over when no living villagers remain (the hero alone doesn't count). The sim marks the game as over; the client shows a game-over screen with the day and cause.
- The sim computes alerts each in-game hour (e.g. "8 days of food left, winter in 3 days", "no firewood in 4 homes"). The client lists them in the HUD.

## Open questions (design session 01, Q11)

- Which alerts and thresholds.

## Done when

- Headless tests: game over triggers; each alert appears and clears at its threshold.
- `pnpm check` passes.

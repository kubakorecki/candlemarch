# Game over, death-spiral alerts and the message log

Status: resolved
Type: task
Blocked by: 10, 14, 15

## What

Spec: Failure states, "Alerts".

- Game over when no living villagers remain (the hero alone doesn't count). The sim marks the game as over; the client shows a game-over screen with the day and cause.
- Alerts are derived from state by an exported sim function (not stored). Each has a severity, text data and a target to jump to.
    - **Red:** a villager dies at the next Dusk (starving) or Dawn (freezing) unless something changes.
    - **Amber:** about N days of Food left (Granary Food ÷ population < 3); in autumn, Food can't cover the rest of autumn plus winter; in autumn/winter, N occupied Houses have an empty firewood buffer; in autumn, firewood in stock < occupied Houses × winter nights; N villagers Hungry / Cold / Homeless; a Hunting ground is Scarce.
    - Food projections ignore Spoilage.
- The client lists alerts in the HUD; clicking one moves the camera to its target. A "winter in N days" countdown shows through autumn.
- Deaths (ticket 15) show in a short message log ("Ada starved, day 14").

## Done when

- Headless tests: game over triggers; each alert appears and clears at its threshold.
- `pnpm check` passes.

## Comments

- 2026-09-27 — Done: `state.gameOver` is set by `killVillager` when the last villager dies (tests in `sim/test/death.test.ts`); the client stops ticking and shows a game-over panel (day and cause) with Load and New game. `alerts(state, content)` and `winterIn` in `sim/src/alerts.ts` (tests in `sim/test/alerts.test.ts`: each alert appears and clears at its threshold); the HUD lists them top-right in red or amber, clicking one centres the camera on its target, with a "Deaths" log of the last 5 deaths below and "Winter in N days" in the readout through autumn. Also: an empty Hunting ground alerts like a Scarce one, and the dev New game panel moved to the bottom right. Thresholds and readings logged in `docs/decisions.md`. Not checked in a browser (none available to this session); the client builds.

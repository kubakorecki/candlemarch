# Game over, death-spiral alerts and the message log

Status: ready-for-agent
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

# Happiness and emigration

Status: resolved
Type: task
Blocked by: 03, m2-camp-winter/13

## What

Spec: Villagers (Happiness in M5; Population). Glossary: Happiness.

- Each villager has a score 0–100, starting at 50, worked out from its sources: Homeless −30; −10 per death in the village in the last 3 days; adjacency (ticket 19). Clamped to 0–100. Hungry, Cold and Tired don't count.
- Bands: Happy ≥ 70 works 20% faster; Unhappy < 30 works 20% slower; the band multiplies on top of the worst slowdown, like the aura.
- A villager Unhappy for 5 Dawns in a row leaves at that Dawn (walks out of the entry), except in winter. A Master leaving counts as losing the Master (ticket 09).
- Immigration: no Newcomer while the villagers' average score is below 30.
- The villager panel lists each source and its value; a House's panel shows each resident's band.

## Done when

- Headless tests: being Homeless lowers the score and a death lowers it for 3 days; the bands change work speed; 5 Unhappy Dawns make a villager leave, not in winter; immigration stops while the average is Unhappy.
- `pnpm check` passes.

## Comments

2026-10-02 — Built. `happiness.ts` works the score out from its sources (Homeless, deaths on the last 3 days; adjacency comes with ticket 19); the band multiplies into `speedPercent` for work, not walking; `systems/happiness.ts` (step 17) counts Unhappy Dawns and sends a villager out of the entry at the 5th (in winter, at the first Dawn after); immigration waits while the average is Unhappy. Added beyond the issue: `state.departures` and chronicle lines ("Ada left the village, day 14", Masters by trade), game over when the last villager leaves, and a House panel listing residents with their bands. Tests on maps without a House now use `homelessContent` so their timings hold. Details in `docs/decisions.md`.

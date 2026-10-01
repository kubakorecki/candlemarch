# Deposits in groups

Status: ready-for-agent
Type: task
Blocked by: none

## What

Spec: World and map (The Valley; Deposits). Today the generator places single Deposits spaced apart (`sim/src/valley/layout.ts`).

- Deposits come in groups of 3–20 on their ground (stone on Rock, clay on Riverbank, iron on a Mountain face), scattered over a patch: never one solid clump, though a few may touch. Group size from the seeded PRNG, so some sites are rich and some poor.
- Per Valley: 5 groups of stone, 4 of clay, 2 of iron (both in the Side valley, one under the Abandoned mine). Near the Camp: a group of stone and a group of clay within 30 tiles.
- Update `valleyProblems` and the 100-seed test for groups; keep "same seed, same Valley". Log retries and timings in `docs/decisions.md`.
- Amounts per Deposit stay as they are; ticket 06 sets them.

## Done when

- Generator tests: every Valley of seeds 1–100 has the right number of groups of each kind, each of 3–20 Deposits, scattered (no group a solid block), with the Camp guarantees; determinism.
- `pnpm check` passes.

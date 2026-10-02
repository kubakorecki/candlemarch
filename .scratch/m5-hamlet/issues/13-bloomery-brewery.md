# Bloomery and brewery

Status: resolved
Type: task
Blocked by: 07, 08, 09

## What

The tier-2 chains the Tavern needs, unlocked at Hamlet and idle until their Master:

- Bloomery (Smith): iron ore + charcoal → iron bars.
- Brewery (Brewer): grain + firewood → ale.

## Done when

- A headless test per chain.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. Bloomery (Smith: 2 iron ore + 1 charcoal → 1 iron bar) and brewery (Brewer: 2 grain + 1 firewood → 2 ale): content, Jobs (smelter, brewer), resources (iron bars, ale; Stockpile goods), Hamlet unlocks, build cards, icons and placeholder art; they run on the recipe system and wait for their Master (ticket 09). The brewery's grain comes from farms' yards only (a Granary isn't a supply). Tests: `packages/sim/test/tier2Workshops.test.ts`. See docs/decisions.md.
- 2026-10-02: Reviewed and committed. The earlier "hanging" sim tests weren't a sim loop: they used ~1% CPU while the machine was swapping, and pass in about 3 s with these changes. Nothing changed for them.

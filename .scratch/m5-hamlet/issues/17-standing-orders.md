# Standing orders

Status: resolved
Type: task
Blocked by: 02, 29, m2-camp-winter/06

## What

Spec: Logistics (Where goods are kept: Standing orders, Helping carry). Glossary: Standing order.

- Each Workplace with outputs has one number N: it pauses while the village holds at least N of its output, and resumes below N. "The village holds" counts Stockpiles, yards, Storage and House buffers, not goods being carried.
- Each output has a default N in content. The chopping block's firewood target becomes this rule (same default; old saves keep working).
- Set by a command; edited in the Workplace's panel.
- A paused Workplace's workers help carry (ticket 29's rule, extended to "paused").

## Done when

- Headless tests: a Workplace pauses at N and resumes below; its workers help carry while paused; the chopping block behaves as before by default; determinism.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. `sim/standingOrders.ts` holds the rule (`building.standingOrder`, `isPaused`, `villageStock` now counting Stockpiles, yards, Storage and House/light fuel, the `setStandingOrder` command); every gatherer and workshop pauses by it, and a paused Workplace's workers help carry (ticket 29's `cantUseWorkers`). Defaults are per resource in content (`ResourceDef.standingOrder`; firewood keeps 40, the chopping block's `stockTarget` is gone; old saves backfill the default). A Workplace with several outputs counts its first (the hunter's lodge: meat). The building panel shows it with − / + by 5. Tests in `sim/test/standingOrders.test.ts`; the production pause test now counts the block's own yard, as the spec's "yards" asks. Not looked at in the browser.

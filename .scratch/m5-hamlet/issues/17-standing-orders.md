# Standing orders

Status: ready-for-agent
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

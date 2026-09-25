# Masters

Status: needs-info
Type: task
Blocked by: 01, m2-camp-winter/06

## What

- Content: the 7 master trades (Carpenter, Mason, Butcher, Smith, Miller, Brewer, Baker) and which workshops each unlocks.
- A trade exists only once its master has settled. The master runs their own workshop with a speed bonus.
- With the master present, more workshops of the trade can be built and staffed by ordinary villagers. If the master dies or leaves, those workshops slow to a crawl.
- Villager panel shows master status.

## Open questions (design session 01, Q2–Q4, Q7)

- What a master is, the bonus, "a crawl", leaving.

## Done when

- Headless tests: a workshop can't be built without its master; the bonus applies; losing the master slows the others.
- `pnpm check` passes.

# Placeable woodcutter's hut and drafting workers

Status: ready-for-agent
Type: task
Blocked by: 01

## What

- Content: the woodcutter's hut becomes `placeable`, with `construction: { cost: 6 logs, buildTicks: 200 }`.
- When any Workplace is finished (a site turns into a building), each open position drafts the **lowest-ID idle Carrier**: their Job changes, they get the Workplace, and the Job's task state is created. An idle carrier is one with no current haul (or, under flag relay, no Segment).
- If no Carrier is idle, the position stays open and is retried each tick until filled.
- The sim exposes "open positions" per building so the client can show a "no worker" icon.
- Workplaces on the starting map keep spawning their own workers.

## Done when

- Headless tests: a placed hut gets built from delivered logs, drafts a carrier, and starts producing logs; with no idle carrier, it waits and then drafts one once a carrier frees up.
- `pnpm check` passes.

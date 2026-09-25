# Bottleneck readability

Status: needs-info
Type: task
Blocked by: m1-roads-logistics/11, 06

## What

From the spec (Logistics, "Making bottlenecks readable"):

- Icons over idle workshops ("waiting for firewood", "output full").
- A carrier-utilization meter in the HUD.
- A road heat-map overlay (traffic per road tile).

## Open questions (after the logistics pick)

- What "utilization" and "traffic" mean under the chosen model.

## Done when

- The sim computes the numbers (headless tests); the client shows them.
- `pnpm check` passes.

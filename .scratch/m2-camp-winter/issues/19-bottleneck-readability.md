# Bottleneck readability

Status: needs-info
Type: task
Blocked by: m1-roads-logistics/11, 06

## What

From the spec (Logistics, "Making bottlenecks readable"):

- Icons over idle workshops ("waiting for firewood", "output full").
- A carrier-utilization meter in the HUD.
- A road heat-map overlay (traffic per road tile).

## Open questions

- What "utilization" and "traffic" mean under job dispatch (ADR-0001). Suggested *(Proposed)*: utilization = the share of Carriers holding a Haul, averaged over a recent window of ticks; traffic = Carrier steps onto each road tile over the same window. These matter more now: without flag relay, bottlenecks aren't visible on the road itself, so this ticket is the main way the player reads them.

## Done when

- The sim computes the numbers (headless tests); the client shows them.
- `pnpm check` passes.

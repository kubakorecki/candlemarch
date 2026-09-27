# Bottleneck readability

Status: ready-for-agent
Type: task
Blocked by: 06

## What

From the spec (Logistics, "Making bottlenecks readable"). Under job dispatch (ADR-0001) these are the main way the player reads bottlenecks.

- Icons over idle workshops: "waiting for logs" (missing input), "output full", "no worker".
- **Carrier utilization** in the HUD: the share of Carriers holding a Haul, averaged over the last in-game day.
- **Road heat-map** overlay: Carrier steps onto each Road tile over the same window.
- The sim keeps the window's counts in state (JSON-safe, deterministic) and exports the derived numbers.

## Done when

- The sim computes the numbers (headless tests); the client shows them.
- `pnpm check` passes.

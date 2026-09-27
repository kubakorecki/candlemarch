# Bottleneck readability

Status: resolved
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

## Comments

- 2026-09-27 — Done. Sim: `workplaceStatus` (`bottlenecks.ts`: no worker / waiting for inputs / output full, derived), `carrierUtilization` and `roadTraffic` (`traffic.ts`) over 24 slices of the last day kept in `state.traffic`, counted by `trafficSystem` (18th in the tick) and by movement for road steps. Client: icons over idle Workplaces, the reason in the Workplace panel, "Carriers busy" in the readout, and a Traffic heat-map toggle (key `t`). Differences: utilization samples only Carriers whose routine is `work` (not asleep); "output full" and "waiting for" cover workshops only, not gatherer huts. See `docs/decisions.md`.

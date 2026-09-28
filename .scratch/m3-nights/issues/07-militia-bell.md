# Militia bell

Status: ready-for-agent
Type: task
Blocked by: 01, 04

## What

Rules in `docs/spec.md`, "Nights in v1 (M3)" (Militia bell). Numbers Proposed, all in content.

- Building: bell, 1×1, 5 logs, one per village.
- Ringing it (a command, from the bell's panel or a HUD button) calls every villager except Watchmen to arms: they drop their work by the unassign rule (goods in hand back, a chop or catch under way lost), walk to the bell and fight Gloamlings within 10 tiles of it.
- Ringing it again stands them down, and so does Dawn. They go back to their Jobs, or Home if it's night.
- A night spent at the bell is a night away from Home: Tired next day, and a Cold night in winter (existing rules, no new ones).

## Done when

- Headless tests: ringing pulls every villager off work, they fight near the bell and return to their Jobs when stood down; Dawn stands them down; ringing at night leaves them Tired; save/load while rung.
- `pnpm check` passes.

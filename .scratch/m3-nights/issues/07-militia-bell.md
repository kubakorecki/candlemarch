# Militia bell

Status: resolved
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

## Comments

- 2026-09-28: Done. Content `bell` (`BellDef` range 10, `onePerVillage`); command `ringBell` toggles; per-villager `militia` flag (the bell rings while anyone has it); `militiaSystem` (11th, before combat) walks the militia after Gloamlings within 10 tiles of the bell or to its door, and stands them down at Dawn; militia villagers hit Gloamlings near the bell in the combat hit loop. Watchmen don't exist yet, so everyone is called (M3-09 excludes them). Militia pick Gloamlings by tile distance, not walking cost. Build time 100 ticks (spec silent). Client: bell art, toolbar `k`, Ring/Stand down on the HUD and the bell's panel. See `docs/decisions.md`.

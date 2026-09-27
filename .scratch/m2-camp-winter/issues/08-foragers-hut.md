# Forager's hut and forage patches

Status: resolved
Type: task
Blocked by: 02, 07, m1-roads-logistics/06

## What

Spec: World and map, "Before full ecology (M2)". Trees don't give food; forage patches do.

- Content: resources `berries`, `mushrooms` (food). Map objects `berry_bush` and `mushroom_patch`, using the generic `mapObjects` shape, with a stock per season (bush: small in spring, large in summer; mushrooms: autumn; nothing in winter).
- At the start of each season a patch's stock refills to that season's amount, **but only if a standing tree is within 2 tiles** (octile/Chebyshev distance, decide and log). A patch without shade doesn't refill and is flagged as withered (derived, not stored, if possible).
- Maps can place patches (new legend characters or a list).
- Building `foragers_hut` with a forager worker and a work radius. The forager gathers from the nearest patch in radius with stock left (ties by ID) and returns food to its output buffer.
- Output buffer supplies the granary (ticket 11); until then, output just fills.
- Client: draw bushes and patches (with berries or mushrooms showing when stocked, bare when empty or withered); a "no shade" hint when a withered patch is selected.

## Done when

- Headless tests: seasonal refill amounts; no refill in winter; felling every tree within 2 tiles stops the refill; the forager picks the nearest stocked patch.
- `pnpm check` passes.

## Comments

- 2026-09-27: Done. `berry_bush`/`mushroom_patch` map objects with a `forage` def (legend `b`/`m`), `patchesSystem` refills at each season's first Dawn (set to the season's amount if a tree is within 2 tiles Chebyshev, else 0; leftovers don't carry over), `isWithered` derived. Forager's hut (`workRadius` 8, Chebyshev from the footprint) and `foragingSystem`; its output goes to the Granary through the existing Food hauling (ticket 11 was already done). Differs from the issue: `BuildingDef.gathers` is now a list and `outputBuffer` a list of per-resource slots, so one hut holds both Foods; a withered patch yields nothing even with stock left (it's drawn bare); the hero can't pick patches. No playable map places patches yet (ticket 20). See `docs/decisions.md`.

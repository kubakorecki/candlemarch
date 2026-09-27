# Forager's hut and forage patches

Status: ready-for-agent
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

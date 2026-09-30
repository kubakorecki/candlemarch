# Points of interest and the Hero's Search

Status: resolved
Type: task
Blocked by: 06

## What

Rules in `docs/spec.md`, World and map ("Points of interest"). Numbers Proposed, all in content.

- Content for three POI types as handcrafted stamps the generator places, never overlapping each other or the Camp:
  - **Ruins** (2 per Valley);
  - **Abandoned mine** (1, on a Mountain face in the Side valley, over an iron Deposit, with a Den at its mouth);
  - **Shrine** (1, on the way from the entry toward the Pass).

  Dens stay M3's object.
- **Search:** a new Hero order on a Ruins. The Hero stands on its tile for 200 ticks, by day only. When done, the Ruins leaves a Cache (M3's Cache): 15 firewood and 6 hides, each ±30% rolled with the PRNG at that moment. A Ruins is Searched once. A Search interrupted (another order, Dusk, Knocked out) starts over.
- **Shrine:** no Den buds within 12 tiles of it (`dens` budding rule).
- The Abandoned mine is only a marker until M5 (a mine on it will cost less). No trapped-master field yet: M6 adds it.
- Client: placeholder art for each POI; the Search cursor and progress; "Searched" in the Ruins panel.

## Done when

- Headless tests: POIs are placed deterministically, never overlapping, with the counts above across 100 seeds; a Search leaves a Cache once and only by day; an interrupted Search starts over; no Den buds within 12 tiles of a Shrine.
- `pnpm check` passes.

## Comments

2026-09-30 — Done. Content: `content.pois` (`PoiDef` per `PoiId`: Ruins' `search` 200 ticks, 15 firewood and 6 hides ±30%; Shrine `wardTiles` 12; the mine a marker) and `content.valley.pois` (2 Ruins, 25 tiles from the Camp, 3×3 cleared stamps, 12 apart, the Shrine 40–60% of the way from the entry to the Pass). Sim: `poi` component (`{kind, searched}`), map characters `R`/`S`/`M`, `pois.ts`, the Hero's `search` order and task, `heroSearch` for the client, budding kept off POIs and out of a Shrine's ward, nothing built or stockpiled on a POI. Generator: `placePois` before `connect`, checked in `valleyProblems`. Client: placeholder art (Ruins dug through once Searched, Shrine, Abandoned mine over its iron), `zoom-in` Search cursor, a progress bar over the Ruins, a point-of-interest panel ("Searched" / "Not yet Searched"). Tests: `sim/test/pois.test.ts`, POI checks in `valley.test.ts`'s 100-seed run (now with its own 20 s timeout), content validation. Beyond the issue: starting Dens also stay out of the Shrine's ward; the mine's Den is the Side valley's Den. Decisions in docs/decisions.md.

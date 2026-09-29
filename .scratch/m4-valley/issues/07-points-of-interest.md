# Points of interest and the Hero's Search

Status: ready-for-agent
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

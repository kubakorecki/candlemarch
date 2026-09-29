# v1 roadmap

Status: open
Created: 2026-09-25

The path from milestone 0 to v1. The finish line is a feature-complete **sandbox** (Camp to Town on a procedural valley) plus **campaign chapter 1**. Shipping and final art are a coarse trailing section.

Vocabulary follows `CONTEXT.md`. Design follows `docs/spec.md`.

## Notes

### How this roadmap works

- Milestones follow the **rank ladder**. Each one ends in something you can watch working, and each rank-up is a playtest point where Proposed numbers can change.
- Every milestone is ticketed. Tickets that depend on an undecided question are marked `needs-info` and get revisited once the decision is made.
- Open design questions are either **gates** (a prototype or playtest ticket that blocks what depends on it) or **defaults with a revisit ticket** after the milestone they arrive in. Where the spec is thin, a **design session** ticket (`/grill-with-docs`) settles the rules first.

### Ticket conventions

- One folder per milestone: `.scratch/<milestone>/spec.md` plus `issues/NN-<slug>.md`.
- `Blocked by:` lists ticket numbers in the same folder (`03`) or in another one (`m1-roads-logistics/11`). Start a ticket only when every ticket it lists is done.
- `Status:`
  - `ready-for-agent`: fully specified. Can be implemented once its blockers are done.
  - `needs-info`: waits on a decision (a design session, gate or playtest in `Blocked by`). Its "Open questions" section says what's missing. When that decision is made, rewrite the ticket and promote it to `ready-for-agent`.
  - `ready-for-human`: design sessions, gates and playtests. The owner drives these.
  - `resolved`: done. Set in the commit that finishes it; numbering and closing rules are in `docs/agents/issue-tracker.md`.
- `Type:` is `task`, `grilling`, `prototype` or `playtest`.
- Every sim ticket also carries the standing rules: a headless test, determinism and save/load coverage, `normalizeLoadedState` for added fields or a `STATE_VERSION` bump for breaking ones, and `pnpm check`.

### Milestones

| # | Milestone | Scope | Tickets |
| --- | --- | --- | --- |
| M1 | Roads + logistics pick | Dirt paths, logs-only stockpiles, placeable woodcutter's hut, flag-relay prototype, scenario maps, A/B playtest and decision | `.scratch/m1-roads-logistics/` |
| M1.5 | Hero playtest | Selectable hero, RTS move/gather/haul orders, aura stubbed; playtest how the hero fits the automation loop | `.scratch/m1-5-hero-playtest/` |
| M2 | Camp survives a winter | Clock (day/night, seasons); named villagers with houses who sleep at night; forager, hunter, fisher; recipes and workshop buffers; granary, eating, spoilage; firewood and warmth; stockpiles for all bulk goods; immigration; starvation and freezing deaths; game over; death-spiral alerts; dawn autosave; bottleneck readability; balance harness in `tooling/balance/` | `.scratch/m2-camp-winter/` |
| M3 | Nights bite | Monster dens and night spawns; torches and braziers; light suppresses spawns; auto-resolve combat; hero fights and gets knocked out; militia bell; palisades; watchtowers; clearing dens | `.scratch/m3-nights/` |
| M4 | The real valley | **Gate (done):** 128² Valley and performance budget (ADR-0004). Procedural Valley with meadow, forest, rock, mountain, river, fords, swamp; Drains and the Pass road; Fog (ADR-0005); forest ecology (forester, Stumps, Game recovery, Reserves); POIs and the Hero's Search | `.scratch/m4-valley/` |
| M5 | Hamlet | Rank system; village hall; quarry, clay pit, mine, farm; masters; notice board; charter invitations; charcoal kiln and tier-1 workshops; **bloomery and brewery**; trade post, coin, imports; tools that wear out; standing orders; happiness and emigration; adjacency | `.scratch/m5-hamlet/` |
| M6 | Village | Tavern; Craftsfolk tier and cottage; mills, bakery, **smithy (tools) and carpenter's workshop (furniture)**; root cellar; caravan, rescue and recommendation invitations; master traits; cobblestone roads; bridges; handcarts; crown tribute | `.scratch/m6-village/` |
| M7 | Town | Guildhall and sandbox win; sandbox settings (seed, hero, winter harshness, monster rate, Fog) and main menu; Ranger and Smith-lord; hero perks per rank; graveyard (stretch) | `.scratch/m7-town/` |
| M8 | Campaign chapter 1 | Mission framework; the five missions (first winter, first master, clear the den, crown tribute, town charter) | `.scratch/m8-campaign/` |
| — | Release (coarse) | Electron vs Tauri, desktop packaging, Steamworks, itch.io builds, save migrations for public builds, art direction and pipeline, options menu | `.scratch/release/` |

### Gates and revisits

- **Logistics A vs B** (M1): decided by the owner's playtest and recorded as ADR-0001. The losing model is deleted afterwards (git history keeps it). Blocks cobblestone roads and handcarts (M6).
- **Map size** (start of M4): decided 2026-09-29, a 128² Valley with a performance budget (ADR-0004).
- **Hero role in automation** (M1.5): playtest. Default until then: hero hand-carries and has an aura.
- **Tools wear out?** Build the Proposed default in M5 (tools wear out; lifetime is a content number). Revisit ticket at the M5 playtest.
- **Art** (cutout animation, 256×128 tiles): Release section; needs an artist decision.

### Cross-cutting rules

- **Saves:** no migration code during development. A load-time `normalizeLoadedState()` fills in fields that are missing because they were added later. `STATE_VERSION` is bumped only for breaking changes, and a mismatched save refuses to load.
- **Balance:** headless balance runs live in `tooling/balance/`, starting in M2.

## Decisions so far

- 2026-09-25 — Finish line is sandbox plus campaign chapter 1; shipping and final art stay coarse.
- 2026-09-25 — Rank-ladder milestones; only the next milestone gets full tickets.
- 2026-09-25 — Keep the spec's post-M0 order (logistics, hero, map size); roads come first because both models need them; the map-size prototype moves to just before procedural generation.
- 2026-09-25 — Monsters (M3) come before procedural generation (M4); dens can sit on hand-made maps.
- 2026-09-25 — Logs-only stockpiles and a placeable woodcutter's hut move into M1 so the A/B playtest has a continuous flow.
- 2026-09-25 — Glossary: House/Hut/Workplace, Rank building (not "milestone building"), Logs/Planks/Firewood (never "wood"), Job (not "role"). See `CONTEXT.md`.
- 2026-09-25 — Every milestone is ticketed. Tickets that wait on a decision are `needs-info`; each milestone with thin spec coverage opens with a design-session ticket.
- 2026-09-25 — Bloomery, brewery and farm move to M5, and smithy and carpenter's workshop to M6. Why: the Tavern (M6's rank building) needs iron bars and ale in stock, and the Craftsfolk tier needs furniture.
- 2026-09-26 — M1 playtest picked job dispatch over flag relay; Flags were fiddly to lay out. See `docs/adr/0001-logistics-model.md`.
- 2026-09-29 — M4 gate: a 128² Valley with a performance budget; the worker steps in place and snapshots split into moving and static parts. See `docs/adr/0004-valley-size-and-budget.md`.
- 2026-09-29 — M4 design session: Fog of three states, living in the sim (`docs/adr/0005-fog-lives-in-the-sim.md`); Fords cross the river, bridges come in M6; a Side valley behind a snowed-in Pass holds the iron; Reserves, Stumps and Game recovery. See `docs/spec.md`, World and map.

## Fog

- How the hero fits the automation loop, until the M1.5 playtest.
- What happens when a non-renewable Deposit runs out (stone, ore), until the M5 design session.
- Every number in the spec (costs, rank requirements, day length), until the balance harness and playtests.
- Audio (music, sound effects): not in the spec at all yet.

# Hunting grounds as tile sets, and Game recovery

Status: ready-for-agent
Type: task
Blocked by: 03, m2-camp-winter/10

## What

Rules in `docs/spec.md`, World and map ("Forest ecology"). Numbers Proposed, all in content.

- A **Hunting ground** becomes a set of tiles instead of a rectangle. Hand-made maps may still give rectangles, converted to tiles when the map is built; `normalizeLoadedState` converts old saves. The ceiling (`max game × standing trees ÷ trees at the start`) counts the standing trees on its tiles.
- **Recovery:** while 0 < Game < ceiling, a ground gains 1 animal every 2 days.
- **Emptied:** a ground whose Game reaches 0 stays empty for 2 full seasons, then 2 animals return (never above the ceiling).
- Client: the ground's outline follows its tiles. The panel adds "Empty; Game returns in N days" and "Recovering". The existing health words stay.

(Saplings maturing raise the ceiling on their own once they count as standing trees; see tickets 09 and 18.)

## Done when

- Headless tests: Game drops with hunting and recovers on schedule; recovery stops at the ceiling; an emptied ground stays empty for 2 seasons, then gets 2 animals; a rectangle on a hand-made map and an old save both become the same tiles.
- `pnpm check` passes.

## Comments

2026-09-27 — M2 design session (m2-camp-winter/01) already gives each Hunting ground a Game count, a ceiling that follows standing trees (surplus flees when trees are felled), and a catch chance of 50% × game ÷ max. This ticket adds recovery: Game regrows toward the ceiling, and foresters raise the ceiling again. See spec, World and map, "Before full ecology (M2)".

2026-09-29 — Design session 03: grounds become tile sets so the generator (06) can make one per stretch of Forest (at most 250 tiles, max Game 1 per 10 trees). The glossary term is Hunting ground, not "forest region".

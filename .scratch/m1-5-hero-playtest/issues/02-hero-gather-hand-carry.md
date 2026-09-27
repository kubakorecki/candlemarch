# Hero: gather and hand-carry

Status: resolved
Type: task
Blocked by: m1-roads-logistics/11, 01

## What

The hero kickstarts the village by hand (spec logistics stage 1, "Hero hand-carry").

- Right-click a tree: walk there, chop (same gather rules as a woodcutter), carry the logs.
- Right-click a building, stockpile or site while carrying: deliver there if it accepts the resource.
- Right-click a building or stockpile with stock while empty-handed: pick up.
- Hero carry capacity from content.

## Open questions

- ~~Under flag relay, may the hero carry off-road, or only drop goods at Flags?~~ Moot: job dispatch was picked (ADR-0001), so the hero carries anywhere, like a Carrier.
- Should the dispatcher count goods the hero is carrying towards a site (so carriers don't double-deliver)? Under job dispatch, a site's need is its missing amount minus Hauls on their way; the hero's load isn't a Haul, so today carriers could overfill a site the hero is also supplying. Options: count the hero's load as incoming once it's ordered to a site, or let the site accept a surplus.

## Done when

- Headless tests for each order, determinism, save/load.
- `pnpm check` passes.

## Comments

2026-09-26 — Done in `4e768d0` (content, sim, client: let the hero gather and hand-carry goods), with review fixes in `9f57f65`. The logistics pick (m1-roads-logistics/11) settled its open question: job dispatch.

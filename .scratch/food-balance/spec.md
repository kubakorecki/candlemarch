# Food balance on the generated Valley

Status: open
Created: 2026-09-30
From: playtest after M4 (`.scratch/play/issues/after-m4.md`), seed 1

## Goal

A sensible start on a generated Valley feeds itself through the first year. Done when seed 1 with the `valley` balance scenario's layout reaches Y2 Spring 1 with no deaths and 1–3 Newcomers.

## Why the playtest starved

Headless runs of seed 1 with a sensible layout found four causes:

1. **The hunter stalls for good after 4 catches (a bug).** Carriers serve Stockpile demand one resource at a time in content order, so logs always come before hides. While a woodcutter keeps refilling its buffer, the lodge's hides buffer (4) never empties and the hunter waits forever, with no icon to say why. Fixing this alone moves seed 1's collapse from summer to winter.
2. **Forage patches sit behind long walks.** The generator keeps every patch reachable, but through winding gaps: a bush 13 tiles from the Camp is a 105-tile walk, many are 30–40. Seed 1 has 4 berry bushes within 20 tiles, each with 3 berries in spring and 8 in summer.
3. **The river is 17 tiles from the Camp on every seed.** Carriers move 1 unit a trip, so one fisher delivered about 1.6 fish a day instead of about 6.
4. **Immigration never fires.** It needs 5 Meals × (population + 1) in the Granaries, but at 25–35% spoilage a day the stock levels off far below 30. The Camp stays at 5 settlers, too few to staff food and hauling together.

## Decisions (owner, 2026-09-30)

- Trees don't block walking: everyone (villagers, the Hero, Gloamlings) crosses them at 50% speed. They still block building.
- Each hunter's lodge can be set to one Hunting ground in reach (default: the nearest with Game, as now). Hunting-ground outlines show only while a hunter's lodge is selected or being placed (and in the woodcutter's hut preview's overlap warning).
- Target: survive year 1 with some growth. The immigration bar may come down to get there.

## Issues

01 valley scenario → 02 fair hauling → 03 walk through trees → 04 ground per lodge → 05 tune and pin.

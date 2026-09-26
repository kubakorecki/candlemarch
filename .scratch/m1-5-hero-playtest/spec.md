# M1.5: Hero playtest

Status: open
Created: 2026-09-25
Roadmap: `.scratch/v1/map.md`

## Goal

Put a mouse-controlled hero on top of the chosen logistics model and find out, by playtest, how the hero fits the automation loop (spec: Heroes, "How the hero fits the automation loop will be playtested once logistics works").

Done when the owner has played with the hero and recorded the hero's role, and the spec is updated.

## Scope

- One hero, spawned by the map. Not a villager, has no Job, can't die (knockout comes in M3).
- RTS control: left-click selects, right-click orders. No WASD.
- Orders: move; gather (chop a tree); hand-carry goods between buildings, stockpiles and sites.
- Aura, stubbed: workplaces within a radius work faster by a percentage (content numbers).

## Waiting on

- Hand-carry: the logistics pick is made (job dispatch, ADR-0001). One question remains in ticket 02: whether the dispatcher counts the hero's load.

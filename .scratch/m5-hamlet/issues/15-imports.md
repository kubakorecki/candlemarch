# Imports

Status: ready-for-agent
Type: task
Blocked by: 14

## What

Spec: Economy (The trade post in M5, Imports). Glossary: Import.

- Order goods at the trade post for twice their base price; the coin leaves the Treasury when ordered (refused if it can't cover it). The next merchant brings them into the trade post's Storage, and Carriers take them where they're wanted.
- M5 catalogue (content): stone, clay, iron ore, iron bars, tools, grain, and turnip seeds (ticket 25 makes seeds do something).

## Done when

- Headless tests: an order spends coin and the goods arrive with the next merchant; an order the Treasury can't cover is refused.
- `pnpm check` passes.

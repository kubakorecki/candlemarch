# Imports

Status: resolved
Type: task
Blocked by: 14

## What

Spec: Economy (The trade post in M5, Imports). Glossary: Import.

- Order goods at the trade post for twice their base price; the coin leaves the Treasury when ordered (refused if it can't cover it). The next merchant brings them into the trade post's Storage, and Carriers take them where they're wanted.
- M5 catalogue (content): stone, clay, iron ore, iron bars, tools, grain, and turnip seeds (ticket 25 makes seeds do something).

## Done when

- Headless tests: an order spends coin and the goods arrive with the next merchant; an order the Treasury can't cover is refused.
- `pnpm check` passes.

## Comments

- 2026-10-02: Done. `orderImport` pays twice the base price at once (refused without a trade post, outside the catalogue, or when the Treasury can't cover it); the next Merchant, after buying the Storage, unloads the order into the trade post, and Carriers take it where it's wanted (a Stockpile, a site, a Granary...). The panel lists the catalogue (Order 5, price each, what's ordered) and what arrived and is still waiting. Differences: the catalogue is stone, clay, iron ore, iron bars and grain for now; `tools` and turnip seeds don't exist yet, so tickets 16 and 25 add them to `merchants.imports` (seeds as an unlock, not a good). Imports wait in the trade post's `stock`, apart from its goods for sale (`input`), and aren't shown in its Storage line but under "Brought in". Checked by tests and typecheck; not looked at in the browser.

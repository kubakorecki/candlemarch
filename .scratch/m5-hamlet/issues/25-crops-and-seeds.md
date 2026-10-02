# Turnips and seeds

Status: resolved
Type: task
Blocked by: 07, 15

## What

Spec: Resources (Farms and crops). Glossary: Crop, Seeds.

- Content: resource `turnips`, a Food: more per Field than grain, slow to spoil (keeps through winter).
- Seeds: buying turnip seeds as an import unlocks turnips for every farm for good (state: the village's known Crops). Seeds aren't a good that's stored or hauled once delivered; the merchant's arrival unlocks the Crop.
- The farm's Crop picker offers known Crops; grain is always known.

## Done when

- Headless tests: turnips can't be picked before seeds arrive; after, a farm set to turnips grows them from next spring; villagers eat them.
- `pnpm check` passes.

## Comments

2026-10-02 — Done. `turnips` is a Food (5 a Field, keeps through winter); the Crop's `seeds` (60 coin) is ordered at the trade post (`orderSeeds`, a Seeds row under Imports in its panel) and the next Merchant makes it known for good (`state.seeds`); seeds are never stored or hauled. The farm's Crop picker offers known Crops only. Beyond the issue: a farm's standing order now counts the Crop it grows. See `docs/decisions.md`.

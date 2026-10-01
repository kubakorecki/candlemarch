# Turnips and seeds

Status: ready-for-agent
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

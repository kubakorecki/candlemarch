# Monster dens and night spawns

Status: needs-info
Type: task
Blocked by: 01, m2-camp-winter/02

## What

- A den map object (placed by maps; the generator places them in M4).
- At night, dens spawn monsters using the seeded PRNG; spawns stop at dawn, and survivors return to their den or vanish.
- Dens slowly multiply toward the village.

## Open questions (design session 01, Q4, Q9)

- Rates, spread rule, season scaling.

## Done when

- Headless tests: spawns only at night, deterministic per seed, spread over time.
- `pnpm check` passes.

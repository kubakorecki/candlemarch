# The Hero is a little weaker against Gloamlings

Status: resolved
Type: task
Blocked by:

## What

The Hero is too strong (owner): 2 hits kill a Gloamling and it takes 25 Gloamling hits to knock the Hero out (`content/combat.ts`). Tune so that (Proposed targets): the Hero beats one Gloamling easily, two at once with real damage, and three at once knocks the Hero out. A Den should still be clearable by a healthy Hero alone.

## Done when

- A headless combat test pins the three outcomes with numbers read from content.
- `nights` scenarios still pass; spec numbers and `docs/decisions.md` updated. `pnpm check` passes.

## Comments

- 2026-09-30 — Done: Hero 55 HP and 9 damage (Gloamlings and Dens unchanged). `combat.test.ts` "the Hero against a pack" pins one (at most a quarter of its HP lost), two at once (at least 40% lost, still standing) and three at once (Knocked out), reading HP from content; `clearDens.test.ts` has a healthy Hero clear a Den with 10 HP left. Spec, decisions updated; `nights` scenarios have no Hero and still pass.

# Decisions

Short log of implementation choices where the spec or `CLAUDE.md` left room. One line each: date, decision, why. Newest at the bottom.

- 2026-09-23 — Workspace packages are consumed as TypeScript source (`exports` → `src/index.ts`), with no build step between them. Why: Vite and Vitest compile TS directly, so one less thing to keep in sync.
- 2026-09-23 — Import boundaries are enforced in four layers: declared pnpm dependencies (strict `node_modules`); no DOM lib in `content`/`sim` tsconfigs; Biome `noRestrictedImports`/`noRestrictedGlobals` overrides; `tooling/boundaries.test.ts` (manifest check plus a grep for `Math.random`/`Date.now`/`performance.now` in sim). Why: each layer is cheap, and together they catch both imports and hidden inputs.
- 2026-09-23 — The client typechecks the worker with a separate `tsconfig.worker.json` (`WebWorker` lib). Why: the DOM and WebWorker libs conflict in one program.
- 2026-09-23 — Added `pnpm format` (`biome check --write .`). Why: to apply Biome fixes; `pnpm lint` stays read-only.
- 2026-09-23 — `step(state, commands, content)` takes content as an argument, as in CLAUDE.md; the spec's `step(state, commands)` is older shorthand. Why: CLAUDE.md wins on engineering rules.
- 2026-09-23 — Tool versions at scaffold: TypeScript 7.0, Vitest 5.0, Biome 2.5, Vite 8.3, PixiJS 8.21, React 19.3, pnpm 11, Node ≥ 22.12. Why: latest stable versions at project start.

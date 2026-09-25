# Release

Status: open
Created: 2026-09-25
Roadmap: `.scratch/v1/map.md`

Coarse on purpose. Shipping and final art depend on decisions and people outside the codebase.

## Scope

- Desktop packaging (spec: Electron or Tauri; CLAUDE.md assumes Electron).
- Steam (Steamworks) and itch.io builds.
- Save migrations once saves are public (development uses `normalizeLoadedState` + `STATE_VERSION` only).
- Final art: confirm cutout animation and a 256×128 base tile; artist or image generation plus cleanup; tooling for export, atlases and rigs.
- Options menu (display, controls).

## Not in the spec yet

- Audio (music, sound effects) isn't mentioned anywhere in `docs/spec.md`.

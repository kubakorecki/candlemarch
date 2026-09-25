# Rename villager roles to Jobs

Status: ready-for-agent
Type: task
Blocked by: none

## What

Make **Job** the only term for what a villager does (see `CONTEXT.md`).

- Content: `villagerRoles` → `jobs`, `VillagerRoleId` → `JobId`, `VillagerRoleDef` → `JobDef`. `BuildingDef.employs[].role` → `.job`.
- Sim: `VillagerComponent.role` → `.job`, `MapDef.villagers[].role` → `.job`, and every use in systems, logistics and tests.
- Client: follow the rename (`WorldRenderer` checks the job).
- This is a breaking state change: bump `STATE_VERSION`.

## Done when

- `grep -ri role packages` finds no villager-role usage.
- Content validation test checks `jobs` the same way it checked roles.
- `pnpm check` passes.

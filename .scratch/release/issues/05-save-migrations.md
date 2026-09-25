# Save migrations for public builds

Status: needs-info
Type: task
Blocked by: m7-town/08

## What

- From the first public build on, saves must survive updates: a migration step per `STATE_VERSION` bump, with a test that loads a saved fixture from each old version.

## Open questions

- When the first public build happens (early access?), which fixes the version migrations start from.

## Done when

- Fixture saves from every public version load.

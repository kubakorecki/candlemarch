# Standing orders

Status: needs-info
Type: task
Blocked by: 02, m2-camp-winter/06

## What

The main automation tool: "keep 50 planks, pause the sawpit above 100".

- Rules stored in state, set by commands, evaluated each tick in a fixed order.
- A UI to add, edit and remove rules.

## Open questions (design session 02, Q7)

- Rule shapes and scope.

## Done when

- Headless tests: a workshop pauses above its limit and resumes below; determinism.
- `pnpm check` passes.

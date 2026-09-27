# Unassign and reassign workers; a workers view

Status: ready-for-agent
Type: task
Blocked by: 03, 06

## What

The player can take a villager off a Workplace (they go back to being a Carrier) or move them to another Workplace. Today staffing is fully automatic: every Workplace drafts idle Carriers into its open positions, and nothing can undo it. With five settlers, a chopping block can take the only Carrier and stall the village.

### Worker limit

Unassigning alone doesn't stick: staffing would draft the new Carrier straight back next tick. So each Workplace has a **worker limit**, and staffing fills positions only up to it. *(Proposed)*

- The limit is 0 up to the building's total `employs` count, in state on the building. New buildings start at the maximum, so nothing changes until the player acts. It's filled in on load, with no `STATE_VERSION` bump.
- Commands (invalid ones are ignored, like every other command):
  - `unassignWorker { villager }`: the villager becomes a Carrier with no Workplace. Their old Workplace's limit drops by one.
  - `reassignWorker { villager, workplace }`: the villager takes a position at `workplace` and gets that Workplace's Job. It's valid only if `workplace` has a position below its maximum that nobody fills. The target's limit rises by one if it's needed to fit them, and the old Workplace's limit drops by one. The position moves with the person, so the old Workplace doesn't draft someone else in their place. A Carrier can be reassigned too; they have no old Workplace.
  - `setWorkerLimit { building, limit }`: raising it lets staffing draft idle Carriers again. Lowering it below the number employed unassigns the most recently assigned workers, highest villager ID first, until it fits.
- A villager who dies (ticket 15) leaves the limit as it was, so the position is filled again automatically.

### What an unassigned worker does with work in hand *(Proposed)*

- **Woodcutter mid-chop:** the chop is abandoned; the tree keeps its logs.
- **Goods in hand:** they go into the old Workplace's output buffer, even if that overfills it (the same rule as a Carrier's returned goods). That way nothing is lost and nobody is stuck holding goods without a Haul.
- **Crafter mid-batch:** the batch is abandoned and its inputs go back into the input buffer.
- They start as a Carrier on the next tick, from where they stand.

### Client

- **Workers view:** a HUD panel, toggled from the toolbar, listing every villager in ID order with name, Job and Workplace ("Carrier" when they have none). Each row has:
  - **Unassign** (hidden for Carriers)
  - **Reassign** to a Workplace with a free position
  
  A summary line on the panel shows the number of Carriers and workers. Clicking a name selects that villager.
- **Building panel:** clicking a Workplace with no tool active opens a panel with:
  - its name, and each worker's name with an **Unassign** button;
  - the worker limit as "2 / 3 workers wanted", with − and + buttons (`setWorkerLimit`).
- The sim decides which Workplaces a villager can be reassigned to, and exports that. The client just lists it (no game logic in the client).

## Done when

- **Headless tests:**
  - An unassigned worker becomes a Carrier and isn't drafted back.
  - Raising the limit drafts an idle Carrier.
  - Reassigning moves the villager and both limits.
  - Lowering the limit unassigns the highest ID first.
  - Invalid commands are ignored.
  - Work in hand (a chop, carried goods, a batch) is handled as above.
  - Determinism, and save/load with a limit below the maximum.
- `pnpm check` passes.

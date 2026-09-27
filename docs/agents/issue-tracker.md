# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Numbering

Number a batch of new issues in dependency order: every issue's blockers in the same folder get lower numbers, so reading a folder in number order never reaches an issue before its blockers. Sort the batch by its `Blocked by:` lines before assigning numbers.

An issue added to an existing folder takes the next free number, even when it blocks a lower-numbered issue (add it to that issue's `Blocked by:`). Existing issues keep their numbers: other folders, `docs/decisions.md` and commit messages refer to them by number. `Blocked by:` is what decides the order.

## Starting an issue

An issue is ready when every issue in its `Blocked by:` is `resolved`. When a blocker turns out not to be needed (the code already does what it would add), tell the owner and get a yes before starting.

## Closing an issue

In the commit that finishes an issue:

- Set `Status: resolved`.
- Append a dated line under `## Comments` saying what was done and anything that differs from the issue (a blocker skipped and why, a requirement changed). The commit's hash doesn't exist yet; `git log` finds it.
- When that resolves the last open issue in the folder, set the folder's `spec.md` to `Status: resolved` too.

A playtest or design session is resolved once its decision is recorded where the issue says (the spec, an ADR).

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

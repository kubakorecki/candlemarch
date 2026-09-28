---
name: run-sessions
description: Plan a folder of issues into ordered implementation sessions, then run each session as a fresh subagent, one after another, checking each before starting the next. Use when the user wants to work through many issues without clearing context between them.
disable-model-invocation: true
argument-hint: <issues folder, e.g. .scratch/m2-camp-winter>
---

You orchestrate. You never implement issues yourself. Keep your own context small: read reports and run cheap checks, never whole diffs or agent transcripts.

## Phase 1: Readiness check, then session plan

1. Read `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` if they exist. For every file in `$ARGUMENTS/issues/`, read only the header: title, `Status:`, `Type:`, `Blocked by:`. Also check whether `$ARGUMENTS/spec.md` exists and what its `Status:` is.

2. Sort each issue into one bucket:
   - **Ready:** `ready-for-agent`, and every blocker is resolved or will be resolved in this run.
   - **Needs triage:** `needs-triage`, or no `Status:` line → run `/triage` on it.
   - **Needs info:** `needs-info` → read its `## Comments` for the open question. The user answers it, or runs `/grilling` (or `/grill-with-docs`) on it.
   - **Design or decision work:** `Type:` is grilling, research or prototype, or the issue says it needs a decision → name the matching skill: `/grilling`, `/research` or `/prototype`.
   - **Owner's:** `ready-for-human`, such as a playtest → the user does it; list it as a checkpoint.
   - **Blocked by a non-agent issue:** a blocker in one of the buckets above → name that blocker.
   - **Done or dropped:** `resolved` or `wontfix` → ignore.

3. Check the folder as a whole:
   - No `spec.md`, or no issues at all → suggest `/to-spec`, then `/to-tickets`.
   - A spec but no issues → suggest `/to-tickets`.
   - `docs/agents/code-map.md` is missing → note that Phase 2 will create it.

4. Report to the user before any planning, in this shape:

   **Ready to run:** 05, 06, 08, 09 (4 issues)
   **Do first:**
   - 03 is needs-triage → `/triage .scratch/<feature>/issues/03-...md`
   - 04 is needs-info: "Should frost kill crops or only slow them?" → answer it, or `/grilling` on 04
   - 07 is a design question → `/grilling` on 07
   **Blocked until those are done:** 10 (by 04), 11 (by 07)
   **Owner checkpoints:** 12 playtest, after 11

   Put "Do first" items in the order that unblocks the most work.

5. If nothing is ready, stop after the report.
   If some issues are ready, ask the user: plan and run only the ready issues now, or stop so they can do the "Do first" items. Blocked issues are never planned.

6. Then write the session plan as before, using only the ready issues. Mark each owner checkpoint in the plan at the point where it falls. Wait for approval.


## Phase 2: Code map (once)

If `docs/agents/code-map.md` doesn't exist, spawn one general-purpose agent to write it (about 100 lines at most). It should cover:
- one line per source file saying what it owns
- the tick or system order
- the state shape
- "how to add X" recipes
- test helpers and how to run one test file
- where decisions and issue comments go

Have it also add a line to CLAUDE.md: "Read docs/agents/code-map.md before exploring the code; update it when you add, move or rename a module." Run the project check, then commit.

## Phase 3: Run sessions

For each line of the plan, in order, spawn ONE general-purpose agent in the background and wait for its completion notice. Never run two at once. Every session builds on the last commit.

If an agent stops because an issue needs a decision, set that issue to `needs-info`, add the question under `## Comments`, and tell the user which skill to run (usually `/grilling`). Then HALT.


Prompt template:

> Implement these issues, in this order: <paths>.
> Start by reading docs/agents/code-map.md, the issue files, and only the spec sections the issues name. Don't re-survey the repo.
> Notes from previous sessions: <accumulated notes: state fields, helpers, system order, test gotchas>
> Workflow: use the tdd skill at the seams the issue names. Typecheck and run single test files as you go, and the full suite once at the end; pipe long output through `tail -40`. Review your own diff against each issue's acceptance criteria and CLAUDE.md, and fix what you find. The project check must pass. Close each issue per the issue-tracker doc. Update the code map if modules changed. Log ambiguous calls in docs/decisions.md. Commit to the current branch with the repo's commit style and attribution line.
> If an issue is blocked, contradicts the code, or needs an owner decision, stop without committing and say why.
> Reply in 15 lines at most: commit hash(es), what was built, deviations from the issues, and "notes for the next session". The next session implements: <next line>.

After each agent finishes, check:
- `git log --oneline -3` shows the new commit(s)
- each issue in the line says `Status: resolved`
- `git status --short` is clean, ignoring `.claude/`
- the project check passes (grep its output for the summary and errors)
- no dev server was left running

If any check fails, or the agent stopped to ask something, HALT and report to the user. Don't continue on a broken base.

Otherwise, tell the user in a few lines what landed and which calls need their eyes: owner-level decisions, anything not checked in a browser. Merge the agent's notes into the running notes and start the next line.

## Finish

Summarise the commits, the deviations to review, and the open issues that are left. Don't mark the folder's spec resolved while human issues (such as playtests) remain open.

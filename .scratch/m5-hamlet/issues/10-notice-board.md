# Notice board

Status: resolved
Type: task
Blocked by: 01, 04

## What

Spec: Trades and masters (Notice board). Glossary: Notice board.

- Building `notice_board`: 1×1, cheap, one per village, unlocked at Hamlet.
- A React panel (Vellum design system) listing what's posted: Charters (ticket 11) and Delivery orders (ticket 26). Each entry shows its conditions met and unmet, its fee or reward, how long it stays up, and an Accept button when every condition holds.
- This ticket builds the board and an empty panel with the list shape; tickets 11 and 26 fill it.

## Done when

- Headless test: only one notice board can be placed; it can't be placed before Hamlet.
- The panel shows live posting state from the sim.
- `pnpm check` passes.

## Comments

- 2026-10-01: Done. Content `notice_board` (1×1, 6 logs, one a village, Hamlet, `noticeBoard` flag); `sim/noticeBoard.ts` with `noticeBoardOf`, the `Posting`/`PostingCondition` shape and `postings` (empty until tickets 11 and 26); tests in `sim/test/noticeBoard.test.ts` (one only, not before Hamlet, builds, nothing posted). Client: build card in the Village tab with its own icon, its art, a selectable panel listing postings as cards from each snapshot (wording in `game/postingText.ts`, tested with hand-made postings). Differs from the ticket: the Accept button is drawn only when the panel gets an `onAccept`, which nothing passes yet; tickets 11 and 26 add the accept command and wire it. Art checked in a throwaway preview page in the browser; the panel wasn't (nothing is posted to show).

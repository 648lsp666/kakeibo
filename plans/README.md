# Animation improvement plans

| Number | Title | Severity | Status | Dependency |
| --- | --- | --- | --- | --- |
| 001 | [Improve mobile usability and add restrained motion](./001-mobile-usability-and-restrained-motion.md) | HIGH | DONE | None |
| 002 | [Float and softly dismiss the sync status](./002-floating-sync-status-exit.md) | MEDIUM | SUPERSEDED | 001 |

## Recommended execution order

Execute plan 001 in its internal step order:

1. Establish shared motion tokens and reduced-motion behavior.
2. Fix sheet, touch-target, narrow-screen, and typography usability issues.
3. Add opt-in press feedback.
4. Add state bridges for pages, statistics, pending bills, notices, and sync status.
5. Run full automated verification and real-device feel checks.

The mobile usability work is deliberately first: motion must not disguise undersized targets or keyboard-obscured actions.

Plan 002 follows the shared motion tokens from plan 001 and removes the sync status from document flow before adding its exit transition.

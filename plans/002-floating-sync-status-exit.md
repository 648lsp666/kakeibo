# Floating sync status with a restrained exit

Status: SUPERSEDED — the global sync overlay was removed after it proved visually distracting.

Commit stamp: `6260b51`

Severity: MEDIUM
Category: Spatial consistency, performance, accessibility

## Problem

`SyncStatusPill` currently participates in the app's flex layout. When the idle “已同步” confirmation reaches its 1.8-second timeout, the component returns `null` immediately. The header height collapses at that moment, so the whole page jumps upward and the status has no visual exit.

## Outcome

Keep the sync surface out of document flow from the moment it appears. “已同步” remains visible for exactly 1.8 seconds, then fades out and moves upward by 6px over 160ms. Because the status is always an absolute overlay, hiding it never changes the content layout. With Reduced Motion enabled, use opacity only.

Important states (`syncing`, `offline`, `auth-required`, `error`, and `local-only`) retain their existing persistence and copy.

## Implementation

### 1. Make the status a non-layout overlay

File: `src/components/sync/SyncStatusPill.tsx`

- Keep a stable outer `AnimatePresence` even when the visual status is hidden.
- Render the visual status inside an absolutely positioned, top-right `motion.div` anchored to the existing positioned app shell.
- Preserve the top safe-area padding and right inset.
- Set `pointerEvents: 'none'`; the surface has no controls.
- Do not animate `height`, `margin`, `padding`, `top`, `right`, or any other layout property.

### 2. Add a restrained exit

- Import and use `useReducedMotion`.
- Normal motion:
  - enter: opacity `0 → 1`, transform `translateY(-6px) → translateY(0)`, 180ms;
  - exit: opacity `1 → 0`, transform `translateY(0) → translateY(-6px)`, 160ms.
- Reduced Motion: keep transform at `translateY(0)` and animate opacity only.
- Use full CSS transform strings rather than Framer Motion transform shorthands.
- Use the established strong ease-out curve `[0.23, 1, 0.32, 1]`.
- Retain the existing 1,800ms idle timer exactly.

### 3. Keep live-region semantics immediate and singular

- Compute a single `shouldRender` condition for session/actionable visibility and the idle timeout.
- Keep the visually hidden `role="status"` conditional outside the exiting visual layer. It should disappear immediately at 1.8 seconds while the `aria-hidden` visual surface completes its exit.
- Mark the whole animated visual surface `aria-hidden="true"` so copy is not announced twice.
- Preserve exactly one live status for every rendered state.

### 4. Verify behavior

File: `src/components/sync/SyncStatusPill.test.tsx`

- Preserve the fake-timer assertion that the live status disappears at exactly 1,800ms.
- Add an assertion that the visual surface is absolutely positioned and therefore never reserves header space.
- Keep all status-copy, signed-out, actionable-state, and singular-live-region tests passing.

Run:

```sh
npx vitest run src/components/sync/SyncStatusPill.test.tsx
npx vitest run
npm run build
```

## Boundaries

- No color, typography, copy, business-status, or app-shell layout changes.
- No new dependency.
- No spring or looping animation.
- No animation of layout properties.
- Preserve unrelated dirty worktree changes.

## Acceptance criteria

- “已同步” is announced and shown immediately, remains for 1.8 seconds, then visually exits in 160ms.
- Hiding the status causes no content shift because it never occupies layout space.
- Reduced Motion removes the 6px translation.
- Important sync states remain visible under the existing rules.
- Targeted tests, full tests, and production build pass.

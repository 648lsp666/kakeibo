# 001 — Improve mobile usability and add restrained motion

- **Status**: DONE
- **Commit**: 6260b51
- **Severity**: HIGH
- **Category**: Accessibility, cohesion, missed opportunities
- **Estimated scope**: 12–16 files, roughly 300–450 lines including tests

## Problem

The mobile shell is structurally sound, but several controls fall below the 44px touch-target floor, bottom sheets do not adapt cleanly to mobile keyboards, and very small financial text reduces readability. At the same time, several occasional state changes teleport while high-frequency buttons provide no immediate press feedback.

Current undersized statistics controls:

```tsx
// src/pages/StatsPage.tsx:67-89 — current calendar control
<button
  type="button"
  key={date}
  onClick={() => setSelectedDay(day)}
  style={{ ...dayCell, ... }}
>
  <span style={{ fontSize: 11 }}>{day}</span>
  <span style={{ fontSize: 8.5 }}>{compactAmount(stat.net)}</span>
</button>

// src/pages/StatsPage.tsx:207 — current arrow target
const arrowBtn: React.CSSProperties = {
  minHeight: 36,
  minWidth: 36,
}

// src/pages/StatsPage.tsx:218 — current day target
const dayCell: React.CSSProperties = { height: 42, ... }
```

Current sheet uses viewport height and scrolls the complete surface, so the footer can move out of reach when the software keyboard opens:

```tsx
// src/components/ui/Sheet.tsx:125-135 — current
style={{
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: '10px 20px max(20px, env(safe-area-inset-bottom))',
}}
```

Current page changes and statistics period changes replace content immediately:

```tsx
// src/App.tsx:49-53 — current
<main style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingBottom: 'calc(90px + env(safe-area-inset-bottom))' }}>
  {activeTab === 'ledger' && <LedgerPage />}
  {activeTab === 'stats' && <StatsPage />}
  {activeTab === 'category' && <CategoryPage />}
  {activeTab === 'settings' && <SettingsPage />}
</main>

// src/pages/StatsPage.tsx:162-164 — current
{period === 'month'
  ? <DailyCalendar yearMonth={currentMonth} stats={dailyStats} />
  : <TrendChart trends={monthlyTrend} period={period} budget={monthlyBudgetAmount ?? null} />}
```

Current pending-bill details and notices appear without a state bridge:

```tsx
// src/components/import/PendingBillsCard.tsx:127-134 — current
{expanded && bill.status === 'failed' && (...)}
{expanded && bill.status === 'pending' && (<form ...>...</form>)}

// src/components/ui/Feedback.tsx:22-40 — current
return <div role={tone === 'error' ? 'alert' : 'status'} style={{ ... }}>...</div>
```

Global interactive elements lack touch-down feedback:

```css
/* src/index.css:45-84 — current */
.icon-button { cursor: pointer; }
.primary-button,
.secondary-button { cursor: pointer; }
```

## Target

### Mobile usability

- Every actionable control is at least `44px × 44px`, including statistics arrows and calendar dates.
- At widths from 320px through 359px, reduce page/card gaps and horizontal padding; never reduce touch targets below 44px.
- Calendar financial text is at least `10px`; primary labels are at least `11px`.
- Sheets use `90dvh`, keep their header and footer visible, and scroll only the content region.
- Sheet footer padding includes `max(16px, env(safe-area-inset-bottom))`.
- Inputs remain visible when the mobile keyboard is open. Use `scrollIntoView({ block: 'nearest' })` only when focus would otherwise be obscured; do not scroll on every keystroke.
- Important typography uses `rem` or `clamp()` where text scaling can expand without corrupting the layout.

### Shared motion vocabulary

Add these exact tokens to `src/styles/theme.css` in both themes through the shared `:root` definition:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--duration-press: 120ms;
--duration-fast: 160ms;
--duration-state: 180ms;
--duration-expand: 220ms;
```

### Six restrained motions

1. **Press feedback** — Feedback, tens/day.
   - Press: `transform: scale(0.97)`.
   - Transition: `transform 120ms var(--ease-out)`.
   - Disabled elements never scale.
   - Apply only to `.primary-button`, `.secondary-button`, `.icon-button`, `.tab-button`, `.calendar-day`, `.keypad-button`, and other explicitly opted-in controls. Do not target every `button` globally.
2. **Page swap** — Preventing a jarring change, tens/day.
   - New page: `opacity: 0 → 1` over `140ms` using `var(--ease-out)`.
   - No translation or scale. The page must be interactive immediately; do not wait for animation completion.
3. **Statistics period swap** — State indication, occasional.
   - Enter: `opacity: 0 → 1`, `transform: translateY(4px) → translateY(0)`, `180ms var(--ease-out)`.
   - Exit: `opacity: 1 → 0`, `120ms var(--ease-out)`.
   - Use keyed `AnimatePresence` with `mode="wait"` only if the 120ms wait is not perceptible on a real phone; otherwise allow overlap with absolute containment to prevent layout jumps.
4. **Pending-bill expansion** — State indication, occasional.
   - Container: `grid-template-rows: 0fr → 1fr`, `opacity: 0 → 1`, `220ms var(--ease-drawer)`.
   - Chevron: `transform: rotate(0deg) → rotate(90deg)`, same duration/curve.
   - The inner wrapper must use `min-height: 0; overflow: hidden`.
5. **Inline notice entrance/exit** — Feedback, occasional.
   - Enter: `opacity: 0 → 1`, `transform: translateY(-4px) → translateY(0)`, `180ms var(--ease-out)`.
   - Exit: same path in reverse, `140ms var(--ease-out)`.
   - Use transitions or Framer Motion; no keyframes that restart under rapid validation changes.
6. **Sync-state change** — State indication, occasional.
   - Crossfade label/icon over `160ms var(--ease-out)`.
   - A refresh icon may rotate once per transition, never loop indefinitely.

Reduced-motion behavior:

```css
@media (prefers-reduced-motion: reduce) {
  .motion-enter,
  .motion-expand,
  .motion-status {
    transform: none !important;
    transition-duration: 160ms !important;
    transition-property: opacity, color, background-color !important;
  }
}
```

Do not preserve the current global `0.01ms` blanket rule for these state-indicating fades. Reduced motion removes displacement, bounce, stagger, and rotation while retaining short opacity/color feedback.

## Repo conventions to follow

- Framer Motion already exists; do not add another animation dependency.
- `src/components/ui/Sheet.tsx:39` uses `useReducedMotion()` and is the exemplar for JS motion branching.
- `src/components/ledger/TransactionItem.tsx:38-45` uses an interruptible spring for gesture-driven movement. Preserve this implementation.
- `src/components/ledger/TransactionList.tsx:110-115` contains the existing group entrance. Do not make it more prominent; reduced-motion behavior must remain supported.
- Global theme and compatibility tokens live in `src/styles/theme.css`.
- Global reusable component classes live in `src/index.css`.
- All interactive controls preserve visible focus outlines and existing ARIA semantics.

## Steps

1. **Add motion tokens.**
   - Edit `src/styles/theme.css` and add the exact shared tokens from the Target section to the light `:root` block.
   - Do not duplicate the values inside the dark media query; CSS inheritance should keep motion identical across themes.
   - Add or extend `src/styles/theme.test.ts` to assert every token exists with the exact value.

2. **Fix global mobile foundations.**
   - Edit `src/index.css`.
   - Add `touch-action: manipulation` to explicit tap controls.
   - Add an opt-in press-feedback selector for the classes listed in the Target section.
   - Add `@media (max-width: 359px)` rules that reduce `.page-scroll` horizontal padding to `12px` and card gaps where class hooks exist, without changing `--tap-size`.
   - Replace the blanket reduced-motion duration reset with component-aware rules: keep `160ms` opacity/color feedback, remove transforms and long transitions.
   - Add `@media (hover: hover) and (pointer: fine)` around any new hover-only styling.

3. **Make the sheet keyboard-safe.**
   - Refactor `src/components/ui/Sheet.tsx` into a non-scrolling surface with three regions: header, scrollable body, optional footer.
   - Surface target: `display: flex`, `flexDirection: column`, `maxHeight: '90dvh'`, `overflow: hidden`.
   - Body target: `overflowY: auto`, `overscrollBehavior: contain`, `WebkitOverflowScrolling: 'touch'`, horizontal padding `20px`.
   - Footer target: `flexShrink: 0`, neutral/elevated background, top border, safe-area bottom padding.
   - Preserve focus trap, focus restoration, Escape handling, overlay click, busy state, spring settings, and portal behavior.
   - Update `src/components/ui/Sheet.test.tsx` to verify `90dvh`, body scrolling, fixed footer structure, and all existing accessibility behavior.

4. **Repair statistics touch and readability.**
   - Edit `src/pages/StatsPage.tsx`.
   - Set arrow controls to `minHeight: 44`, `minWidth: 44`.
   - Give each day button class `calendar-day` and a minimum height of `44px`; use a minimum inline size that does not overflow a seven-column 320px layout.
   - Increase daily net text from `8.5px` to at least `10px` and ensure long compact amounts truncate rather than widen the grid.
   - Add a narrow-screen class/rule that changes the calendar gap from `4px` to `2px` only at `max-width: 359px`.
   - Update `src/pages/StatsPage.test.tsx` with minimum target and readable-text assertions.

5. **Add explicit press classes.**
   - Add `tab-button` to the four navigation buttons in `src/components/layout/TabBar.tsx` and press feedback to the central add button through an explicit class.
   - Add `keypad-button` to keys in `src/components/entry/AmountInput.tsx`.
   - Ensure all primary/secondary/icon buttons receive feedback through their existing classes.
   - Do not animate delete confirmation holds, text inputs, disabled controls, or the swipeable transaction row itself.

6. **Bridge page swaps.**
   - In `src/App.tsx`, isolate the active page into a keyed wrapper.
   - Prefer a CSS opacity entrance or Framer Motion `motion.div` with `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, and `transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}`.
   - With reduced motion, use the same `140ms` opacity-only feedback; do not disable it.
   - Preserve each page's independent scrolling and the bottom navigation's stable position.
   - Extend `src/App.test.tsx` to verify tabs still switch synchronously and only one active page is accessible.

7. **Bridge statistics-period changes.**
   - In `src/pages/StatsPage.tsx`, key the month calendar and trend panel by `period`.
   - Apply the exact entry/exit recipe from Target.
   - Ensure rapid repeated taps retarget cleanly and never leave both panels accessible.
   - Extend `src/pages/StatsPage.test.tsx` to cover rapid `month → halfYear → year → month` changes.

8. **Animate pending-bill expansion.**
   - Refactor only the conditional detail blocks in `src/components/import/PendingBillsCard.tsx`.
   - Add an always-mounted grid wrapper or `AnimatePresence` that supports interruption.
   - Apply the exact `220ms var(--ease-drawer)` recipe and rotate the chevron.
   - Under reduced motion, retain a `160ms` opacity fade with no height interpolation or rotation.
   - Extend `src/components/import/PendingBillsCard.test.tsx` to verify ARIA expanded state, field accessibility, and collapse cleanup; tests must not wait for decorative timing.

9. **Animate notices without changing their API.**
   - Keep `InlineNotice` call sites source-compatible.
   - Add a wrapper strategy in `src/components/ui/Feedback.tsx` or at conditional call sites that enables the exact entrance/exit recipe.
   - Do not delay validation messages or live-region announcements. DOM insertion and ARIA announcement happen immediately; visual animation is independent.
   - Update `src/components/ui/Feedback.test.tsx` for retained `role="alert"`/`role="status"` semantics and reduced-motion behavior.

10. **Crossfade sync status.**
    - Edit `src/components/sync/SyncStatusPill.tsx` and key only the label/icon content by status kind.
    - Use `160ms` opacity crossfade; optional one-time icon rotation must be omitted under reduced motion.
    - Preserve live-region semantics, retry actions, and current positioning.
    - Extend `src/components/sync/SyncStatusPill.test.tsx` for state changes without timing-dependent sleeps.

11. **Verify on narrow and keyboard-constrained viewports.**
    - Test at 320×568, 375×667, 390×844, and 430×932.
    - On iOS Safari or responsive emulation, open the add-entry sheet, focus note/date fields, and confirm the save button remains reachable.
    - Confirm landscape orientation does not trap content behind the sheet footer or bottom navigation.

## Boundaries

- Do NOT add dependencies; use existing Framer Motion and CSS.
- Do NOT redesign colors, typography hierarchy, icons, navigation structure, business logic, persistence, imports, sync, or transaction deletion.
- Do NOT increase the existing transaction-list stagger or add animations to charts, financial values, keypad digits, or every list row.
- Do NOT change the transaction swipe spring in `src/components/ledger/TransactionItem.tsx`.
- Do NOT add looping animation, parallax, decorative blur, confetti, or bounce unrelated to a physical gesture.
- Do NOT reduce any target below 44px to make a layout fit.
- Do NOT use `transition: all`, `scale(0)`, or new keyframe animations for interruptible state.
- If the cited structure has materially drifted from commit `6260b51`, STOP and report the mismatch instead of improvising.

## Verification

- **Mechanical**:
  - Run `npx vitest run`; expect all test files and tests to pass.
  - Run `npm run build`; expect TypeScript and Vite production build to pass.
  - Search with `rg -n "transition:\s*all|scale\(0\)|ease-in" src`; expect no newly introduced matches.
  - Search with `rg -n "minHeight:\s*(3[0-9]|4[0-3])|height:\s*(3[0-9]|4[0-3])" src/pages/StatsPage.tsx`; verify no actionable statistics control is below 44px.
- **Feel check**:
  - On a real phone, rapidly tap navigation tabs. Content responds immediately, crossfades subtly, and never slides or blocks input.
  - Press and release buttons repeatedly. The scale is visible as feedback but never reads as a bounce.
  - Open the add-entry sheet with the software keyboard visible. Header and save action remain reachable while only the form body scrolls.
  - Rapidly toggle statistics periods and pending-bill expansion. Motion retargets from its current state without flashing or restarting from zero.
  - Trigger success, warning, error, and sync-state changes. Live-region announcements remain immediate, and visual transitions use symmetric paths.

## Verification notes

- Correction pass completed on 2026-07-18 without adding dependencies or changing financial business logic; final status awaits motion re-review.
- Automated verification: 47 test files / 307 tests passed; TypeScript and Vite production build passed.
- Forbidden-pattern scans found no `transition: all`, `scale(0)`, undersized actionable statistics controls, or newly introduced `ease-in` usage. The only `ease-in` matches are the required `--ease-in-out` token and its test.
- Responsive behavior is covered structurally at the requested breakpoints; physical-device feel checks remain a release QA step.
  - In DevTools Animations, set playback to 10% and confirm no page transition overlaps into a double-readable state and no element scales from zero.
  - Toggle `prefers-reduced-motion`. Position, height, stagger, and rotation motion disappear; short opacity/color feedback remains.
  - Confirm scrolling stays at 60fps during sheet animation and transaction swiping on a mid-range phone.
- **Done when**:
  - All actionable controls are at least 44px in every target viewport.
  - Sheet actions remain reachable with the mobile keyboard open.
  - All six motion recipes match the exact values in Target.
  - Reduced-motion behavior retains useful feedback without spatial movement.
  - Full tests and production build pass, and the existing swipe-delete interaction feels unchanged.

## Completion

- Implemented and animation-reviewed on 2026-07-18.
- Final `review-animations` verdict: **Approve** after one scoped correction pass.
- Automated verification: 47 test files and 307 tests passed; production build and `git diff --check` passed.
- Forbidden-pattern scan found no `transition: all`, `scale(0)`, animated grid sizing, or Framer Motion `y` shorthand in the scoped motion files.
- Remaining release QA: feel-check 320×568, 375×667, 390×844, and 430×932 on a physical phone or responsive emulator, including the software keyboard.

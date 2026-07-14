# Task 5 Report: Statistics and Budget Surfaces

## Status

Complete.

## Changes

- Added a focused `StatsPage` smoke test for the approved summary and trend copy, category data, and formatted spending.
- Reworked statistics into a padded `.page-scroll` with an accessible month toolbar, three summary cards, and separate semantic surfaces.
- Preserved `maxExpense`, `budgetLineBottom`, the fixed 16/60/20px chart rows, percentages, merchant aggregation display, and month-picker callbacks.
- Migrated chart, category, and merchant visuals to semantic tokens and shared icons; removed the page-local merchant emoji dependency.
- Reworked budget cards to retain existing threshold calculations while adding explicit normal/warning/over-budget text and semantic colors.
- Migrated budget setup to shared `Sheet` and `InlineNotice` components while retaining validation messages, period/date behavior, and CRUD callbacks.

## TDD Evidence

- Red: `npx vitest run src/pages/StatsPage.test.tsx` failed against the old summary/trend copy.
- Green: focused tests passed after implementation.

## Verification

- `npx vitest run src/pages/StatsPage.test.tsx src/hooks/useTransactions.test.ts`: 2 files, 4 tests passed.
- `npx vitest run`: 18 files, 48 tests passed.
- `npm run build`: TypeScript and Vite production build succeeded.
- `git diff --check`: clean.

## Self-review

- Scope is limited to the five Task 5 files listed in the brief.
- No budget calculations, persistence operations, validation strings, or month-selection callbacks were changed.
- No remaining hard-coded hex colors exist in the changed production files.

## Concerns

- None identified.

## Accessibility Remediation (2026-07-15)

### Fixes

- Restored the `var(--tap-size)` 44px contract on the budget add action and added it explicitly to all three period controls and both custom date inputs.
- Audited all Task 5 interactive controls: statistics month navigation already used `var(--tap-size)`; setup footer and close actions already inherited the shared 44px button classes; the budget card and amount input exceed 44px through their content and padding.
- Added `--color-primary-text`, `--color-expense-text`, `--color-warning-text`, and `--color-income-text` in light and dark themes.
- Kept `--color-primary`, `--color-expense`, `--color-warning`, and `--color-income` unchanged for bars, borders, dashed rules, and legend swatches.
- Migrated Task 5 accent-colored text in statistics, budget cards, and the setup delete action to the corresponding contrast-safe text tokens. The 9px historical chart amount now uses `--color-text-small` instead of the low-contrast tertiary token.

### TDD Evidence

- Red command: `npx vitest run src/components/budget/BudgetAccessibility.test.tsx src/pages/StatsPage.test.tsx src/styles/theme.test.ts`.
- Red result: exit 1; 3 files failed, with 6 expected failures covering the missing semantic tokens, old accent text tokens, the 36px add override, and missing period/date minimum heights.
- Green command: `npx vitest run src/components/budget/BudgetAccessibility.test.tsx src/pages/StatsPage.test.tsx src/styles/theme.test.ts`.
- Green result: exit 0; 3 files passed, 8 tests passed.
- Regression coverage includes exact `var(--tap-size)` usage, exact Task 5 text/graphic token separation in `StatsPage`, exact normal/warning/over-budget text tokens in `BudgetCard`, exact delete text/border tokens in `BudgetSetupSheet`, and calculated 4.5:1 contrast for all four semantic text tokens against card, secondary, danger-soft, elevated, and primary-soft surfaces in both themes.

### Verification

- `npx vitest run`: exit 0; 19 files passed, 54 tests passed.
- `npm run build`: exit 0; TypeScript and Vite build succeeded, 475 modules transformed.
- `git diff --check`: exit 0; no whitespace errors.

## Selected-period Contrast Remediation (2026-07-15)

### Fix

- Replaced the active `BudgetSetupSheet` period tokens `--color-tab-active` / `--color-fab-text` with the verified semantic pair `--color-primary` / `--color-on-primary`.
- Left the inactive period tokens and all compatibility/decorative theme aliases unchanged.
- The selected-period contrast is 4.820:1 in the light theme and 8.365:1 in the dark theme, both above the 4.5:1 requirement.

### TDD Evidence

- Red command: `npx vitest run src/components/budget/BudgetAccessibility.test.tsx src/styles/theme.test.ts`.
- Red result: exit 1; the component regression expected `--color-primary` / `--color-on-primary` but received `--color-tab-active` / `--color-fab-text`; the theme contrast regression passed.
- Green result: exit 0; 2 files passed, 8 tests passed after the two-token component change.
- Regression coverage asserts the exact selected-period component pair and calculates the actual `--color-on-primary` on `--color-primary` ratio from both theme definitions.

### Verification

- `npx vitest run`: exit 0; 19 files passed, 56 tests passed.
- `npm run build`: exit 0; TypeScript and Vite build succeeded, 475 modules transformed.
- `git diff --check`: exit 0; no whitespace errors.

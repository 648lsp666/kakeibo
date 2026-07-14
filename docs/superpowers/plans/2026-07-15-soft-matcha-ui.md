# Soft Matcha UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade every existing Kakeibo screen to the approved light/dark “抹茶慢生活” design while preserving all finance, import, budget, and WebDAV behavior.

**Architecture:** Add a semantic CSS design system and a local rounded-line SVG icon registry, then introduce a small set of reusable UI primitives before restyling feature components in vertical slices. Existing Zustand state, hooks, IndexedDB operations, CSV parsers, and WebDAV functions remain the source of behavior; presentation components consume their current data and callbacks.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Tailwind CSS 4 (existing import only), Framer Motion 12, Zustand 5, Vitest 4, Testing Library, IndexedDB/idb.

## Global Constraints

- Cover ledger, statistics, categories, settings, add-entry, month picker, budget, CSV import, and WebDAV UI.
- Preserve the four-page navigation, central add-entry action, business flows, data semantics, and persistence behavior.
- Provide complete warm matcha light and dark themes; components must use semantic variables instead of hard-coded colors.
- Replace all visible Emoji with the local rounded-line SVG icon system; do not add a remote icon or font dependency.
- Retain legacy category data without a database migration; map known stored Emoji to stable icon names and use a generic fallback.
- Keep all interactive targets at least 44px, provide visible focus, text or labels for non-decorative icons, and honor `prefers-reduced-motion`.
- Support 390px and 430px mobile widths without horizontal overflow or collisions for long text and large amounts.
- Do not change CSV parsing, duplicate detection, amount precision, date semantics, category IDs, WebDAV protocol, database schema version, or Zustand architecture.
- Do not add accounts, savings goals, gamification, social features, network fonts, remote illustrations, or a full Tailwind migration.

---

## File Structure

**Create**

- `src/components/ui/Icon.tsx` — local SVG symbol registry and typed `Icon` renderer.
- `src/components/ui/Icon.test.tsx` — icon rendering, accessibility, legacy mapping, and fallback tests.
- `src/components/ui/Sheet.tsx` — shared animated overlay, bottom-sheet surface, handle, title, and close action.
- `src/components/ui/Feedback.tsx` — `InlineNotice`, `EmptyState`, and `ConfirmDialog` primitives.
- `src/components/ui/Feedback.test.tsx` — feedback semantics and confirmation behavior tests.
- `src/components/layout/TabBar.test.tsx` — navigation and add-action regression tests.
- `src/components/entry/AddSheet.test.tsx` — inline validation and save behavior tests.
- `src/pages/StatsPage.test.tsx` — statistics data-preservation smoke test.
- `src/components/category/CategoryForm.test.tsx` — icon selection and category submission tests.
- `src/components/settings/DataManager.test.tsx` — destructive confirmation regression test.

**Modify**

- `src/styles/theme.css` — complete semantic light/dark palette, radii, shadows, sizing, and motion variables.
- `src/index.css` — base reset, focus, button, safe-area, reusable surface/control classes, and reduced-motion rules.
- `src/types/index.ts` — backwards-compatible category `icon` field and optional legacy `emoji` field.
- `src/lib/seed.ts`, `src/lib/seed.test.ts`, `src/lib/db.test.ts` — stable system-category icon names and legacy compatibility expectations.
- `src/App.tsx` — app shell, safe areas, and stable page surface.
- `src/components/layout/TabBar.tsx` — floating rounded navigation with line icons.
- `src/pages/LedgerPage.tsx`, `src/components/ledger/MonthHeader.tsx`, `TransactionList.tsx`, `DateGroup.tsx`, `TransactionItem.tsx` — ledger redesign.
- `src/components/entry/AddSheet.tsx`, `AmountInput.tsx`, `CategoryPicker.tsx` — add-entry redesign and inline validation.
- `src/components/ledger/MonthPickerSheet.tsx`, `src/components/import/CSVImportButton.tsx`, `CSVPreviewSheet.tsx` — shared sheet and feedback styling.
- `src/pages/StatsPage.tsx`, `src/components/budget/BudgetSection.tsx`, `BudgetCard.tsx`, `BudgetSetupSheet.tsx` — statistics and budget redesign.
- `src/pages/CategoryPage.tsx`, `src/components/category/CategoryList.tsx`, `CategoryItem.tsx`, `CategoryForm.tsx`, `src/hooks/useCategories.ts` — icon-based categories.
- `src/pages/SettingsPage.tsx`, `src/components/settings/WebDAVConfig.tsx`, `DataManager.tsx` — grouped settings, semantic status, and custom confirmation.
- `vite.config.ts` — PWA matcha theme and background colors.

---

### Task 1: Semantic Theme and Rounded-Line Icon System

**Files:**
- Create: `src/components/ui/Icon.tsx`
- Create: `src/components/ui/Icon.test.tsx`
- Modify: `src/styles/theme.css`
- Modify: `src/index.css`
- Modify: `src/types/index.ts`
- Modify: `src/lib/seed.ts`
- Modify: `src/lib/seed.test.ts`
- Modify: `src/lib/db.test.ts`

**Interfaces:**
- Produces: `IconName`, `Icon`, `categoryIconName(category)`, and `LEGACY_EMOJI_ICON_MAP` from `src/components/ui/Icon.tsx`.
- Produces: `Category.icon?: IconName` and backwards-compatible `Category.emoji?: string`.
- Consumed by: every later UI task.

- [ ] **Step 1: Write failing icon and seed compatibility tests**

Create `src/components/ui/Icon.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, categoryIconName } from './Icon'
import type { Category } from '../../types'

const category = (patch: Partial<Category>): Category => ({
  id: 'custom', name: '测试', type: 'expense', isSystem: false,
  sortOrder: 0, createdAt: '2026-07-15T00:00:00.000Z', ...patch,
})

describe('Icon', () => {
  it('renders a labelled rounded-line svg', () => {
    render(<Icon name="food" label="餐饮" />)
    expect(screen.getByRole('img', { name: '餐饮' })).toHaveAttribute('viewBox', '0 0 24 24')
  })

  it('hides decorative icons from assistive technology', () => {
    const { container } = render(<Icon name="ledger" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('prefers a stable icon name, maps legacy emoji, and falls back', () => {
    expect(categoryIconName(category({ icon: 'coffee', emoji: '🍜' }))).toBe('coffee')
    expect(categoryIconName(category({ emoji: '🍜' }))).toBe('food')
    expect(categoryIconName(category({ emoji: 'unknown' }))).toBe('category')
  })
})
```

Update `src/lib/seed.test.ts` to replace the Emoji assertion:

```ts
it('includes 餐饮 with a stable icon name', async () => {
  await seedCategories()
  const canteen = (await categoryOps.list()).find(c => c.name === '餐饮')
  expect(canteen?.icon).toBe('food')
  expect(canteen?.isSystem).toBe(true)
})
```

Update `mockCat()` in `src/lib/db.test.ts` to use `icon: 'food'` and omit `emoji`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run src/components/ui/Icon.test.tsx src/lib/seed.test.ts src/lib/db.test.ts`

Expected: FAIL because `Icon.tsx` and `Category.icon` do not exist and seeded categories still store Emoji.

- [ ] **Step 3: Add backwards-compatible category types and icon implementation**

In `src/types/index.ts`, import the icon type and update `Category`:

```ts
import type { IconName } from '../components/ui/Icon'

export interface Category {
  id: string
  name: string
  icon?: IconName
  emoji?: string
  type: TransactionType
  isSystem: boolean
  sortOrder: number
  createdAt: string
}
```

Create `src/components/ui/Icon.tsx` with this public shape and a local path for every listed name:

```tsx
import type { Category } from '../../types'

export const ICON_NAMES = [
  'ledger', 'chart', 'category', 'settings', 'plus', 'close', 'chevron-left',
  'chevron-right', 'download', 'upload', 'cloud', 'database', 'trash', 'warning',
  'check', 'info', 'calendar', 'target', 'wallet', 'food', 'cart', 'transit',
  'game', 'home', 'medical', 'book', 'briefcase', 'coins', 'gift', 'coffee',
  'tea', 'plane', 'beauty', 'pet', 'phone', 'fitness', 'music', 'camera', 'more',
] as const

export type IconName = (typeof ICON_NAMES)[number]

export const LEGACY_EMOJI_ICON_MAP: Record<string, IconName> = {
  '🍜': 'food', '🛒': 'cart', '🚌': 'transit', '🎮': 'game', '🏠': 'home',
  '💊': 'medical', '📚': 'book', '📦': 'category', '💼': 'briefcase',
  '💰': 'coins', '🎁': 'gift', '☕': 'coffee', '🍵': 'tea', '✈️': 'plane',
  '💄': 'beauty', '🐶': 'pet', '📱': 'phone', '🏋️': 'fitness', '🎵': 'music', '📷': 'camera',
}

const paths: Record<IconName, React.ReactNode> = {
  ledger: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h7M8 11h5"/></>,
  chart: <><path d="M5 19v-7M12 19V5M19 19v-4"/><path d="M3 19h18"/></>,
  category: <><path d="m20 13-7 7-9-9V4h7z"/><circle cx="8" cy="8" r="1"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.4-2.4-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.4 2.4.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.4 2.4 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.4-2.4-.9-1.9.7-1.7z"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  'chevron-left': <path d="m15 18-6-6 6-6"/>, 'chevron-right': <path d="m9 18 6-6-6-6"/>,
  download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
  cloud: <path d="M7 18h11a4 4 0 0 0 .5-8A6 6 0 0 0 7 8.5 4.5 4.5 0 0 0 7 18z"/>,
  database: <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
  trash: <><path d="M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  warning: <><path d="M12 3 2.5 20h19z"/><path d="M12 9v4M12 17h.01"/></>,
  check: <path d="m5 12 4 4L19 6"/>, info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12"/><path d="M15 11h5v4h-5a2 2 0 0 1 0-4z"/></>,
  food: <><path d="M6 3v7M9 3v7M6 7h3M7.5 10v11M16 3c-2 3-2 7 0 9h2V3zM17 12v9"/></>,
  cart: <><path d="M3 4h2l2 11h10l3-7H6M9 20h.01M17 20h.01"/></>,
  transit: <><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 15h.01M16 15h.01M8 19l-2 2M16 19l2 2"/></>,
  game: <><path d="M8 8h8a5 5 0 0 1 4.5 7.2L19 18h-3l-2-2h-4l-2 2H5l-1.5-2.8A5 5 0 0 1 8 8z"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-6h6v6"/></>,
  medical: <><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></>,
  book: <><path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2zM20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2z"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2"/></>,
  coins: <><ellipse cx="9" cy="7" rx="5" ry="3"/><path d="M4 7v4c0 1.7 2.2 3 5 3s5-1.3 5-3V7M6 14v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-4"/><path d="M14 10c3 0 5 1.3 5 3s-2 3-5 3"/></>,
  gift: <><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M7.5 9C5 9 5 5 7 5c2 0 5 4 5 4M16.5 9C19 9 19 5 17 5c-2 0-5 4-5 4"/></>,
  coffee: <><path d="M4 8h13v6a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 10h1a3 3 0 0 1 0 6h-2"/><path d="M7 4v2M11 3v3M15 4v2"/></>,
  tea: <><path d="M5 9h12v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6zM17 11h1a3 3 0 0 1 0 6h-2"/><path d="M12 9c0-3 2-5 5-5-1 3-2 5-5 5z"/></>,
  plane: <><path d="M22 2 9 15M22 2l-7 19-4-8-8-4z"/></>, beauty: <><path d="M8 3h8v4H8zM7 7h10v14H7zM10 11h4"/></>,
  pet: <><circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="5" cy="13" r="2"/><circle cx="19" cy="13" r="2"/><path d="M12 11c-4 0-6 4-4 7 1.5 2 6.5 2 8 0 2-3 0-7-4-7z"/></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></>,
  fitness: <><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></>,
  music: <><path d="M9 18V5l10-2v13M9 8l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
  camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
}

export function Icon({ name, size = 20, label, className }: {
  name: IconName; size?: number; label?: string; className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      {paths[name] ?? paths.category}
    </svg>
  )
}

export function categoryIconName(category?: Pick<Category, 'icon' | 'emoji'>): IconName {
  if (category?.icon && ICON_NAMES.includes(category.icon)) return category.icon
  if (category?.emoji && LEGACY_EMOJI_ICON_MAP[category.emoji]) return LEGACY_EMOJI_ICON_MAP[category.emoji]
  return 'category'
}
```

TypeScript's `Record<IconName, React.ReactNode>` enforces that every declared icon has a local SVG definition.

Replace each `emoji` in `SYSTEM_CATEGORIES` in `src/lib/seed.ts` with these exact icon values: `food`, `cart`, `transit`, `game`, `home`, `medical`, `book`, `category`, `briefcase`, `coins`, `gift`.

- [ ] **Step 4: Define complete light/dark semantic tokens and base controls**

Replace the palette in `src/styles/theme.css` with semantic variables including the following exact foundations:

```css
:root {
  color-scheme: light;
  --color-bg: #f7f6ed;
  --color-bg-secondary: #eef1e3;
  --color-bg-card: #fffdf7;
  --color-bg-elevated: #ffffff;
  --color-text: #344033;
  --color-text-secondary: #748071;
  --color-text-tertiary: #9ca597;
  --color-border: #e2e5d8;
  --color-primary: #718b61;
  --color-primary-strong: #58734c;
  --color-primary-soft: #e1ebd3;
  --color-income: #4f8a70;
  --color-expense: #c96f68;
  --color-warning: #b6813f;
  --color-danger-soft: #f9e7e3;
  --color-overlay: rgb(35 44 32 / 48%);
  --shadow-card: 0 10px 30px rgb(76 91 62 / 10%);
  --radius-hero: 22px;
  --radius-card: 16px;
  --radius-control: 14px;
  --tap-size: 44px;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --color-bg: #1c211b;
    --color-bg-secondary: #272e24;
    --color-bg-card: #242a22;
    --color-bg-elevated: #2d342a;
    --color-text: #edf1e7;
    --color-text-secondary: #b3bdad;
    --color-text-tertiary: #858f80;
    --color-border: #394135;
    --color-primary: #9db88b;
    --color-primary-strong: #b4cba4;
    --color-primary-soft: #34422f;
    --color-income: #7fc39f;
    --color-expense: #e0938c;
    --color-warning: #d3a15e;
    --color-danger-soft: #442c2a;
    --color-overlay: rgb(8 12 8 / 68%);
    --shadow-card: inset 0 0 0 1px rgb(255 255 255 / 4%);
  }
}
```

In `src/index.css`, add a system Chinese font stack, `button/input { font: inherit; }`, `:focus-visible` outline using `--color-primary`, `.surface`, `.icon-button`, `.primary-button`, `.secondary-button`, `.page-scroll`, safe-area padding, and a reduced-motion media query that sets animation and transition durations to `0.01ms`.

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run src/components/ui/Icon.test.tsx src/lib/seed.test.ts src/lib/db.test.ts && npm run build`

Expected: all focused tests PASS; TypeScript and Vite build complete without errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Icon.tsx src/components/ui/Icon.test.tsx src/styles/theme.css src/index.css src/types/index.ts src/lib/seed.ts src/lib/seed.test.ts src/lib/db.test.ts
git commit -m "feat: add soft matcha design system and icons"
```

---

### Task 2: Shared Sheet and Feedback Primitives

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Create: `src/components/ui/Feedback.tsx`
- Create: `src/components/ui/Feedback.test.tsx`

**Interfaces:**
- Consumes: `Icon`, `IconName`, and semantic theme classes from Task 1.
- Produces: `Sheet`, `InlineNotice`, `EmptyState`, and `ConfirmDialog`.
- Consumed by: Tasks 4–7.

- [ ] **Step 1: Write failing feedback primitive tests**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog, EmptyState, InlineNotice } from './Feedback'

it('exposes semantic status text', () => {
  render(<InlineNotice tone="error">连接失败</InlineNotice>)
  expect(screen.getByRole('alert')).toHaveTextContent('连接失败')
})

it('renders an empty state action', async () => {
  const onAction = vi.fn()
  render(<EmptyState icon="ledger" title="本月暂无记录" actionLabel="记一笔" onAction={onAction} />)
  await userEvent.click(screen.getByRole('button', { name: '记一笔' }))
  expect(onAction).toHaveBeenCalledOnce()
})

it('requires explicit confirmation', async () => {
  const onConfirm = vi.fn()
  render(<ConfirmDialog open title="清除所有账单？" description="此操作不可恢复" confirmLabel="确认清除" onConfirm={onConfirm} onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: '确认清除' }))
  expect(onConfirm).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run src/components/ui/Feedback.test.tsx`

Expected: FAIL because `Feedback.tsx` does not exist.

- [ ] **Step 3: Implement the shared sheet**

Create `Sheet.tsx` with an `AnimatePresence` overlay, a bottom-aligned `motion.section`, background `var(--color-overlay)`, `maxWidth: 430`, safe-area bottom padding, a visual handle, title, optional description, and close icon button.

```tsx
export interface SheetProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  zIndex?: number
}

export function Sheet(props: SheetProps): React.ReactNode
```

The overlay click closes; surface clicks stop propagation; the section uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` tied to the title. Use the existing spring values `{ damping: 30, stiffness: 300 }` and rely on global reduced-motion CSS.

- [ ] **Step 4: Implement feedback primitives**

Create `Feedback.tsx` with these exact interfaces:

```tsx
export type NoticeTone = 'success' | 'warning' | 'error' | 'info'
export function InlineNotice({ tone, children }: { tone: NoticeTone; children: React.ReactNode }): React.ReactNode

export function EmptyState(props: {
  icon: IconName; title: string; description?: string; actionLabel?: string; onAction?: () => void
}): React.ReactNode

export function ConfirmDialog(props: {
  open: boolean; title: string; description: string; confirmLabel: string;
  tone?: 'danger' | 'primary'; busy?: boolean; onConfirm: () => void; onClose: () => void
}): React.ReactNode
```

`InlineNotice` uses `role="alert"` only for `error`, otherwise `role="status"`; it selects `check`, `warning`, or `info` icons without Emoji. `ConfirmDialog` composes `Sheet`, disables both action buttons when `busy`, and never calls `window.confirm`.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/components/ui/Feedback.test.tsx`

Expected: 3 tests PASS.

```bash
git add src/components/ui/Sheet.tsx src/components/ui/Feedback.tsx src/components/ui/Feedback.test.tsx
git commit -m "feat: add shared sheets and feedback primitives"
```

---

### Task 3: App Shell, Floating Navigation, and Ledger Experience

**Files:**
- Create: `src/components/layout/TabBar.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/TabBar.tsx`
- Modify: `src/pages/LedgerPage.tsx`
- Modify: `src/components/ledger/MonthHeader.tsx`
- Modify: `src/components/ledger/TransactionList.tsx`
- Modify: `src/components/ledger/DateGroup.tsx`
- Modify: `src/components/ledger/TransactionItem.tsx`

**Interfaces:**
- Consumes: `Icon`, `categoryIconName`, `EmptyState`, existing `useAppStore`, transaction hooks, and category hooks.
- Preserves: existing `MonthHeader` callback props and ledger transaction deletion callback.

- [ ] **Step 1: Write failing navigation tests**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { TabBar } from './TabBar'
import { useAppStore } from '../../store/appStore'

beforeEach(() => useAppStore.setState({ activeTab: 'ledger', isAddSheetOpen: false }))

it('switches tabs and exposes the active page', async () => {
  render(<TabBar />)
  await userEvent.click(screen.getByRole('button', { name: '统计' }))
  expect(useAppStore.getState().activeTab).toBe('stats')
  expect(screen.getByRole('button', { name: '统计' })).toHaveAttribute('aria-current', 'page')
})

it('opens add entry from the central action', async () => {
  render(<TabBar />)
  await userEvent.click(screen.getByRole('button', { name: '记一笔' }))
  expect(useAppStore.getState().isAddSheetOpen).toBe(true)
})
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run src/components/layout/TabBar.test.tsx`

Expected: FAIL because the current buttons have no accessible names/current state matching the new contract.

- [ ] **Step 3: Rebuild the shell and navigation**

In `App.tsx`, replace the inline root with `.app-shell`, keep `max-width: 430px`, use `min-height: 100dvh`, and reserve safe-area-aware space for the floating tab bar.

In `TabBar.tsx`, replace `emoji` with typed icon names:

```tsx
const TABS: { id: TabName; icon: IconName; label: string }[] = [
  { id: 'ledger', icon: 'ledger', label: '账单' },
  { id: 'stats', icon: 'chart', label: '统计' },
  { id: 'category', icon: 'category', label: '分类' },
  { id: 'settings', icon: 'settings', label: '设置' },
]
```

Render a floating rounded surface with 44px tab targets, `aria-label`, `aria-current`, visible labels, and a central 52px primary button labelled “记一笔” using `<Icon name="plus" />`.

- [ ] **Step 4: Redesign the ledger header and page feedback**

Keep `MonthHeader`'s current props. Render a hero surface with “慢慢生活” eyebrow, an accessible month selector between previous/next icon buttons, large responsive expense amount, and two inset cards for income and balance. Place the existing CSV import node in a secondary header action.

Replace the hard-coded green import success block in `LedgerPage.tsx` with `<InlineNotice tone="success">…</InlineNotice>` and convert CSV parse error state from `alert` to a local `importError` rendered as `InlineNotice tone="error"`.

- [ ] **Step 5: Redesign transaction groups and rows**

In `TransactionList`, replace the Emoji empty state with:

```tsx
<EmptyState
  icon="ledger"
  title="本月还没有记录"
  description="从一笔小花费开始，慢慢记下生活。"
  actionLabel="记一笔"
  onAction={useAppStore.getState().openAddSheet}
/>
```

Keep the existing grouping and sort algorithm. Use semantic list markup and CSS classes for date headings. In `TransactionItem`, render `<Icon name={categoryIconName(category)} />`, keep the Framer Motion drag constraints and spring, replace the trash Emoji with `<Icon name="trash" />`, and show source text in a pill. Ensure note/category text uses ellipsis and the amount never shrinks.

- [ ] **Step 6: Run tests, build, and commit**

Run: `npx vitest run src/components/layout/TabBar.test.tsx src/hooks/useTransactions.test.ts && npm run build`

Expected: tests PASS and build succeeds.

```bash
git add src/App.tsx src/components/layout/TabBar.tsx src/components/layout/TabBar.test.tsx src/pages/LedgerPage.tsx src/components/ledger/MonthHeader.tsx src/components/ledger/TransactionList.tsx src/components/ledger/DateGroup.tsx src/components/ledger/TransactionItem.tsx
git commit -m "feat: redesign navigation and ledger experience"
```

---

### Task 4: Add Entry, Month Picker, and CSV Import Sheets

**Files:**
- Create: `src/components/entry/AddSheet.test.tsx`
- Modify: `src/components/entry/AddSheet.tsx`
- Modify: `src/components/entry/AmountInput.tsx`
- Modify: `src/components/entry/CategoryPicker.tsx`
- Modify: `src/components/ledger/MonthPickerSheet.tsx`
- Modify: `src/components/import/CSVImportButton.tsx`
- Modify: `src/components/import/CSVPreviewSheet.tsx`

**Interfaces:**
- Consumes: `Sheet`, `InlineNotice`, `Icon`, `categoryIconName`, current hooks and callbacks.
- Preserves: `CSVImportButton` and `CSVPreviewSheet` public props; `MonthPickerSheet` public props.

- [ ] **Step 1: Write failing inline-validation test**

Mock `useTransactions` and `useCategories`, open the store sheet, and assert validation without `window.alert`:

```tsx
it('shows an inline amount error and does not save zero', async () => {
  useAppStore.setState({ isAddSheetOpen: true })
  render(<AddSheet />)
  await userEvent.click(screen.getByRole('button', { name: '保存记录' }))
  expect(screen.getByRole('alert')).toHaveTextContent('请输入大于 0 的金额')
  expect(addTransaction).not.toHaveBeenCalled()
})
```

Add the save-path assertion in the same test file:

```tsx
it('saves a valid manual expense and closes the sheet', async () => {
  useAppStore.setState({ isAddSheetOpen: true, currentMonth: '2026-07' })
  render(<AddSheet />)
  for (const key of ['2', '8', '.', '5', '0']) {
    await userEvent.click(screen.getByRole('button', { name: key }))
  }
  await userEvent.click(screen.getByRole('button', { name: '保存记录' }))
  expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({
    amount: 28.5, type: 'expense', categoryId: 'sys-food', source: 'manual',
  }))
  expect(useAppStore.getState().isAddSheetOpen).toBe(false)
})
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npx vitest run src/components/entry/AddSheet.test.tsx`

Expected: FAIL because the current component calls `alert` and has no labelled save action/error region.

- [ ] **Step 3: Compose the add-entry sheet**

Replace the custom overlay in `AddSheet` with `Sheet`. Add local `amountError`; clear it when the keypad changes; render `<InlineNotice tone="error">请输入大于 0 的金额</InlineNotice>` on invalid save. Keep existing date/category defaults and submission payload. Label the primary action “保存记录”.

Restyle `AmountInput` with a responsive amount display, 44px minimum keypad targets, and `<Icon name="close" />` or an explicit backspace SVG for deletion with `aria-label="删除一位"`. `CategoryPicker` uses `categoryIconName`, semantic icon containers, and `aria-pressed`.

- [ ] **Step 4: Migrate auxiliary sheets and import feedback**

Compose `MonthPickerSheet` and `CSVPreviewSheet` with `Sheet`. Preserve their current selection, preview truncation, duplicate identification, cancel, and confirm callbacks. Replace warning Emoji with `InlineNotice tone="warning"`; use semantic colors and disable the confirm action while importing.

Update `CSVImportButton` to render `<Icon name="download" />` with visible “导入账单” text and keep the hidden input, accepted extensions, encoding fallback, source detection, and error callback unchanged.

- [ ] **Step 5: Run tests, build, and commit**

Run: `npx vitest run src/components/entry/AddSheet.test.tsx src/lib/csv-wechat.test.ts src/lib/csv-alipay.test.ts && npm run build`

Expected: all tests PASS; build succeeds.

```bash
git add src/components/entry/AddSheet.tsx src/components/entry/AddSheet.test.tsx src/components/entry/AmountInput.tsx src/components/entry/CategoryPicker.tsx src/components/ledger/MonthPickerSheet.tsx src/components/import/CSVImportButton.tsx src/components/import/CSVPreviewSheet.tsx
git commit -m "feat: redesign entry and import sheets"
```

---

### Task 5: Statistics and Budget Surfaces

**Files:**
- Modify: `src/pages/StatsPage.tsx`
- Modify: `src/components/budget/BudgetSection.tsx`
- Modify: `src/components/budget/BudgetCard.tsx`
- Modify: `src/components/budget/BudgetSetupSheet.tsx`

**Interfaces:**
- Consumes: existing `useStats`, `useBudget`, `Sheet`, `InlineNotice`, and `Icon`.
- Preserves: all budget rule status calculations and CRUD callbacks.

- [ ] **Step 1: Capture existing behavior with a focused stats smoke test**

Add a test block to a new `src/pages/StatsPage.test.tsx` that mocks `useStats`, `useCategories`, and `useBudget`, renders one expense category and one trend point, and asserts visible text for “本月支出”, “近 6 个月”, category name, and formatted amount. The test must not assert layout pixels.

- [ ] **Step 2: Run the smoke test before restyling**

Run: `npx vitest run src/pages/StatsPage.test.tsx`

Expected: FAIL only for the new approved copy “近 6 个月” if the current text is “近6个月支出趋势”; existing data assertions pass.

- [ ] **Step 3: Recompose the statistics page**

Keep current calculations (`maxExpense`, `budgetLineBottom`, chart fixed heights, percentages, and merchant data). Convert the page to `.page-scroll`; add an accessible month toolbar, a three-card summary labelled “本月支出 / 本月收入 / 本月结余”, and separate `.surface` sections for budget, “近 6 个月”, category breakdown, and merchant breakdown.

Replace blue/gray/red hard-coded chart colors with `var(--color-primary)`, `var(--color-text-tertiary)`, and `var(--color-expense)`. Use `categoryIconName` for categories and a generic `wallet` or `category` icon for merchants rather than `getMerchantEmoji`; remove the now-unused import.

- [ ] **Step 4: Redesign budget components without changing calculations**

Replace the BudgetSection target Emoji with `<Icon name="target" />`; use `EmptyState`-style copy when no rules exist. In `BudgetCard`, keep `pct`, `isOver`, and threshold logic but use semantic tokens for normal/warning/over-budget states and text alongside color.

Compose `BudgetSetupSheet` with `Sheet`, retain all current validation strings and period/date behavior, replace the warning Emoji with `InlineNotice tone="error"`, and use semantic danger/primary/secondary buttons.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/pages/StatsPage.test.tsx src/hooks/useTransactions.test.ts && npm run build`

Expected: tests PASS and build succeeds.

```bash
git add src/pages/StatsPage.tsx src/pages/StatsPage.test.tsx src/components/budget/BudgetSection.tsx src/components/budget/BudgetCard.tsx src/components/budget/BudgetSetupSheet.tsx
git commit -m "feat: redesign statistics and budgets"
```

---

### Task 6: Icon-Based Category Management

**Files:**
- Create: `src/components/category/CategoryForm.test.tsx`
- Modify: `src/pages/CategoryPage.tsx`
- Modify: `src/components/category/CategoryList.tsx`
- Modify: `src/components/category/CategoryItem.tsx`
- Modify: `src/components/category/CategoryForm.tsx`
- Modify: `src/hooks/useCategories.ts`

**Interfaces:**
- Consumes: `IconName`, `Icon`, `categoryIconName`, `Sheet`, `ConfirmDialog`, and category CRUD hook.
- Produces: new custom categories with `{ name, icon, type }`; legacy `emoji` remains readable but is not written.

- [ ] **Step 1: Write failing category form test**

```tsx
it('submits a stable icon name instead of emoji', async () => {
  const onSave = vi.fn()
  render(<CategoryForm onSave={onSave} onCancel={() => {}} />)
  await userEvent.type(screen.getByLabelText('分类名称'), '咖啡')
  await userEvent.click(screen.getByRole('button', { name: '咖啡图标' }))
  await userEvent.click(screen.getByRole('button', { name: '保存分类' }))
  expect(onSave).toHaveBeenCalledWith({ name: '咖啡', icon: 'coffee', type: 'expense' })
})
```

Add the empty-name assertion:

```tsx
it('shows inline validation for an empty name', async () => {
  const onSave = vi.fn()
  render(<CategoryForm onSave={onSave} onCancel={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: '保存分类' }))
  expect(screen.getByRole('alert')).toHaveTextContent('请输入分类名称')
  expect(onSave).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Verify failure**

Run: `npx vitest run src/components/category/CategoryForm.test.tsx`

Expected: FAIL because the current form exposes Emoji and calls `alert`.

- [ ] **Step 3: Change category creation to stable icons**

Change `CategoryForm` props to:

```ts
onSave: (data: { name: string; icon: IconName; type: TransactionType }) => void
```

Use an explicit icon choice list:

```ts
const CATEGORY_ICON_OPTIONS: IconName[] = [
  'food', 'cart', 'transit', 'game', 'home', 'medical', 'book', 'category',
  'coffee', 'tea', 'plane', 'gift', 'beauty', 'pet', 'phone', 'fitness', 'music', 'camera',
]
```

Default to `category`, label each icon button in Chinese, use `aria-pressed`, label the input “分类名称”, and show inline validation. Update `useCategories.addCategory` input typing so `icon` is written and `emoji` is optional/omitted.

- [ ] **Step 4: Redesign the category page and deletion flow**

Use `.page-scroll`, a title/description header, and separate expense/income surfaces. `CategoryItem` renders `categoryIconName(category)`, name, and restrained “系统” text only where useful. Replace trash Emoji and `window.confirm` with a delete icon button that asks the page to open `ConfirmDialog`; only custom categories expose deletion.

Compose the create form with `Sheet`. Preserve current `addCategory` and `deleteCategory` calls and system-category protection.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/components/category/CategoryForm.test.tsx src/lib/seed.test.ts src/lib/db.test.ts && npm run build`

Expected: tests PASS and build succeeds.

```bash
git add src/pages/CategoryPage.tsx src/components/category/CategoryList.tsx src/components/category/CategoryItem.tsx src/components/category/CategoryForm.tsx src/components/category/CategoryForm.test.tsx src/hooks/useCategories.ts
git commit -m "feat: redesign icon-based category management"
```

---

### Task 7: Grouped Settings, WebDAV Status, and Safe Data Actions

**Files:**
- Create: `src/components/settings/DataManager.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/components/settings/WebDAVConfig.tsx`
- Modify: `src/components/settings/DataManager.tsx`

**Interfaces:**
- Consumes: `Icon`, `InlineNotice`, and `ConfirmDialog`.
- Preserves: existing sync config keys, upload/download functions, export JSON shape, and transaction clearing behavior.

- [ ] **Step 1: Write failing destructive-action test**

At the top of `DataManager.test.tsx`, use these mocks before the test:

```tsx
const mocks = vi.hoisted(() => ({ clear: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({ clear: mocks.clear }),
  transactionOps: { getAll: vi.fn().mockResolvedValue([]) },
  categoryOps: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../lib/seed', () => ({ seedCategories: vi.fn().mockResolvedValue(undefined) }))
```

Then verify the confirmation flow:

```tsx
it('clears transactions only after custom confirmation', async () => {
  render(<DataManager />)
  await userEvent.click(screen.getByRole('button', { name: '清除所有账单记录' }))
  expect(mocks.clear).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '确认清除' }))
  expect(mocks.clear).toHaveBeenCalledWith('transactions')
  expect(seedCategories).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run src/components/settings/DataManager.test.tsx`

Expected: FAIL because the current component uses `window.confirm` and has no custom confirmation button.

- [ ] **Step 3: Redesign WebDAV configuration and semantic statuses**

Keep all sync config reads/writes and WebDAV calls. Replace the single string `status` with:

```ts
type SyncStatus = { tone: NoticeTone; message: string } | null
```

Use `success` for saved/uploaded/synced, `error` for caught errors, and `info` for uploading/downloading. Render `InlineNotice`, remove status Emoji, disable action buttons during an active request, label all fields, and use `cloud`, `upload`, `download`, and `check` icons.

- [ ] **Step 4: Redesign data management and settings grouping**

In `DataManager`, retain the JSON export implementation. Replace button Emoji with icons, add a local `confirmOpen`, use `ConfirmDialog`, and replace the completion `alert` with an `InlineNotice tone="success"` message “已清除所有账单记录”.

In `SettingsPage`, create a page header and grouped surfaces titled “同步与备份” and “数据管理”, keeping the version at low emphasis. Use `page-scroll` and bottom safe-area spacing.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/components/settings/DataManager.test.tsx src/lib/db.test.ts && npm run build`

Expected: tests PASS and build succeeds.

```bash
git add src/pages/SettingsPage.tsx src/components/settings/WebDAVConfig.tsx src/components/settings/DataManager.tsx src/components/settings/DataManager.test.tsx
git commit -m "feat: redesign settings and data feedback"
```

---

### Task 8: PWA Theme, Emoji Audit, Accessibility, and Visual Regression

**Files:**
- Modify: `vite.config.ts`
- Modify: any UI file found by the audits below, limited to violations of the approved design.

**Interfaces:**
- Consumes: all completed UI tasks.
- Produces: a fully verified application with no visible Emoji or hard-coded legacy palette.

- [ ] **Step 1: Update PWA colors**

In `vite.config.ts`, set:

```ts
theme_color: '#718b61',
background_color: '#f7f6ed',
```

Do not change icons, caching, routing, display mode, or Tauri build configuration.

- [ ] **Step 2: Audit visible Emoji and legacy hard-coded colors**

Run:

```bash
rg -n "[📒📊🏷️⚙️🍜🛒🚌🎮🏠💊📚📦💼💰🎁☕🍵✈️💄🐶📱🏋️🎵📷🗑️📥📤⚠️✅❌🎯]" src
rg -n "#3b82f6|#e11d48|#111111|#ffffff|rgba\(0,0,0,0\.5\)" src
```

Expected: no visible UI Emoji matches. Color matches are allowed only inside the centralized theme/icon implementation where semantically justified; feature components must use variables.

- [ ] **Step 3: Run automated verification**

Run: `npx vitest run && npm run build`

Expected: all Vitest files PASS and the production build completes without TypeScript errors.

- [ ] **Step 4: Run the app and perform viewport/theme checks**

Run: `npm run dev -- --host 127.0.0.1`

At both 390×844 and 430×932, inspect all four pages plus add-entry, month picker, budget, category form, CSV preview, confirmation, and feedback states. Repeat with light and dark color schemes. Verify:

- No horizontal scrolling, clipped focus rings, chart overlap, or bottom-nav/safe-area collision.
- Long merchant names and notes ellipsize; six-digit amounts do not collide with actions.
- All controls are at least 44px and keyboard focus is visible.
- Reduced-motion mode removes non-essential movement.
- Empty, loading, success, warning, error, duplicate-import, and over-budget states use icon plus text.

Record any defect as a precise file-level correction, apply it, and rerun `npx vitest run && npm run build` before continuing.

- [ ] **Step 5: Manually regress business flows**

Verify in order: add expense, add income, change month, swipe-delete a transaction, create/delete a custom category, add/edit/delete each budget period, preview CSV import, export JSON, save WebDAV config, and exercise WebDAV failure feedback with an invalid local URL. Confirm amounts, dates, category IDs, duplicate counts, and stored config keys match pre-redesign behavior.

- [ ] **Step 6: Commit final polish**

```bash
git add vite.config.ts src
git commit -m "chore: verify soft matcha UI accessibility and polish"
```

---

## Final Verification

- [ ] Run `npx vitest run` — expected: every test passes.
- [ ] Run `npm run build` — expected: TypeScript and Vite build succeed.
- [ ] Run both Emoji/color audit commands — expected: no visible Emoji or feature-level legacy colors.
- [ ] Confirm the eight manual viewport/theme/state checks and ten business-flow regressions from Task 8.
- [ ] Compare the result against `docs/superpowers/specs/2026-07-15-soft-matcha-ui-design.md` and verify every success criterion is satisfied.

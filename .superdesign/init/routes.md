# Routes / view state

This is a single-page Vite/React application without a URL router. `src/App.tsx` switches the main view through Zustand `activeTab` state while retaining one shared mobile shell.

| View state | Component | Shared layout |
|---|---|---|
| `ledger` | `src/pages/LedgerPage.tsx` | App shell, SyncStatusPill, TabBar, AddSheet |
| `stats` | `src/pages/StatsPage.tsx` | App shell, SyncStatusPill, TabBar, AddSheet |
| `category` | `src/pages/CategoryPage.tsx` | App shell, SyncStatusPill, TabBar, AddSheet |
| `settings` | `src/pages/SettingsPage.tsx` | App shell, SyncStatusPill, TabBar, AddSheet |

The core product is mobile-first with a 430px maximum shell. The ledger is the default view. Add-entry, month-picker, confirmation, import preview, budget setup, and settings forms render as modal bottom sheets.

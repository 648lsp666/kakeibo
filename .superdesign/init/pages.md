# Page dependency trees

## Ledger (default view)

Entry: `src/pages/LedgerPage.tsx`

- `src/components/ledger/MonthHeader.tsx`
  - `src/components/ui/Icon.tsx`
- `src/components/ledger/MonthPickerSheet.tsx`
  - `src/components/ui/Sheet.tsx`
  - `src/components/ui/Icon.tsx`
- `src/components/ledger/TransactionList.tsx`
  - `src/components/ledger/DateGroup.tsx`
    - `src/components/ledger/TransactionItem.tsx`
      - `src/components/ui/Icon.tsx`
  - `src/components/ui/Feedback.tsx`
    - `src/components/ui/Sheet.tsx`
- `src/components/budget/BudgetSection.tsx`
  - `src/components/budget/BudgetCard.tsx`
  - `src/components/budget/BudgetSetupSheet.tsx`

## Statistics

Entry: `src/pages/StatsPage.tsx`

- `src/components/ui/Icon.tsx`
- `src/components/ledger/MonthPickerSheet.tsx`
  - `src/components/ui/Sheet.tsx`

## Categories

Entry: `src/pages/CategoryPage.tsx`

- `src/components/category/CategoryList.tsx`
  - `src/components/category/CategoryItem.tsx`
    - `src/components/ui/Icon.tsx`
- `src/components/category/CategoryForm.tsx`
  - `src/components/ui/Icon.tsx`
- `src/components/ui/Sheet.tsx`
- `src/components/ui/Feedback.tsx`

## Settings

Entry: `src/pages/SettingsPage.tsx`

- `src/components/settings/CloudSyncCard.tsx`
  - `src/components/ui/Icon.tsx`
  - `src/components/ui/Feedback.tsx`
- `src/components/settings/BillInboxConfig.tsx`
- `src/components/settings/WebDAVConfig.tsx`
- `src/components/settings/DataManager.tsx`
  - `src/components/import/CSVImportButton.tsx`
  - `src/components/import/CSVPreviewSheet.tsx`
  - `src/components/ui/Sheet.tsx`

## Shared shell on every page

- `src/App.tsx`
  - `src/components/layout/TabBar.tsx`
  - `src/components/sync/SyncStatusPill.tsx`
  - `src/components/entry/AddSheet.tsx`
    - `src/components/entry/AmountInput.tsx`
    - `src/components/entry/CategoryPicker.tsx`
    - `src/components/ui/Sheet.tsx`
- `src/index.css`
- `src/styles/theme.css`

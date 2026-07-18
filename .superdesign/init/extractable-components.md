# Extractable components

## TabBar
- Source: `src/components/layout/TabBar.tsx`
- Category: layout
- Description: Floating five-action bottom navigation with central add button.
- Extractable props: `activeItem` (string, default `ledger`)
- Hardcoded: Chinese tab labels, SVG icon names, central add action, all styling

## MonthHeader
- Source: `src/components/ledger/MonthHeader.tsx`
- Category: basic
- Description: Month selector and three-value income/expense/balance hero summary.
- Extractable props: none; example values should be hardcoded in design drafts
- Hardcoded: labels, month navigation icons, typography and layout

## TransactionItem
- Source: `src/components/ledger/TransactionItem.tsx`
- Category: basic
- Description: Swipeable ledger row with semantic income/expense background, category icon, source badge and amount.
- Extractable props: none; use representative hardcoded rows in drafts
- Hardcoded: visual structure, icon treatment, badge and swipe affordance

## Sheet
- Source: `src/components/ui/Sheet.tsx`
- Category: basic
- Description: Mobile modal bottom sheet with grabber, title, description, close action and footer.
- Extractable props: `isOpen` (boolean, default `true`)
- Hardcoded: modal shell and spacing

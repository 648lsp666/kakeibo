# Kakeibo design system

## Product and UX

Kakeibo is a calm, mobile-first Chinese personal finance ledger. The interface must make income, expenses, budgets, categories, import/sync state, and destructive actions immediately understandable without feeling like an enterprise dashboard. Target viewport is 430px wide; all touch targets are at least 44px.

## Visual character

- Quiet, tactile, warm, trustworthy, lightly Japanese-inspired without decorative clichés.
- Use soft natural neutrals and restrained semantic colors. Avoid fluorescent color, cold corporate blue, pure white expanses, gradients, and heavy shadows.
- Maintain high legibility for Chinese text and numeric amounts.
- System font stack only: PingFang SC / Microsoft YaHei / Noto Sans CJK SC / system sans.

## Color architecture

- Four neutral elevations: app canvas, grouped background, card, raised sheet.
- One botanical primary family for selection, navigation, and primary actions.
- Avoid red-versus-green pairing in normal financial data. Income uses a muted ink-indigo family; expense uses a warm ochre family. Their tinted row backgrounds must remain subtle enough for long ledger lists. Red/coral is reserved exclusively for destructive actions, errors, and critical over-budget states.
- Warning uses muted amber. Error/danger stays coral-red.
- Source badges use semantic families but cannot compete with transaction amounts.
- Light and dark themes must preserve the same semantic relationships and WCAG-readable text contrast.
- Exact currently implemented values are in `src/styles/theme.css`; design variants may tune those values coherently, but must not introduce colors outside the defined token roles.

## Shape, spacing, elevation

- 4px base spacing rhythm; common gaps 8/12/16/20/24px.
- Controls: 14px radius. Cards: 16px. Hero: 22px. Floating navigation: 24px. Pills: 999px.
- Cards use a thin low-contrast border and soft diffuse shadow. Dark mode uses a subtle inset border rather than bright drop shadows.
- Prefer whitespace and grouping over extra dividers.

## Components

- Primary buttons: filled botanical color, dark readable label, 44px minimum height.
- Secondary buttons: card background, neutral border, botanical label.
- Transaction rows: full-width semantic tint (ink-indigo income, warm ochre expense), category glyph in a compact rounded tile, merchant/title, category and source metadata, bold tabular amount. Plus/minus signs and labels remain mandatory so meaning never depends on color.
- Summary cards: compact hierarchy; semantic amount color, neutral labels.
- Bottom nav: floating card with four destinations and raised central add button.
- Sheets: elevated neutral surface with clear grabber, title, close target, scrollable body, fixed action footer.
- Charts: botanical default bars; coral only for over-budget or expenses; labels remain neutral.
- Monthly finance calendar: treat it as a calm "month map," never a spreadsheet. Use a borderless seven-column layout with generous gaps and softly rounded day tiles. Empty days stay visually quiet. Active days may show at most two compact semantic cues (ink-indigo income and warm-ochre expense); exact selected-day amounts belong in a dedicated detail strip below the calendar. Avoid dense grid lines, tiny legends detached from the data, and more than two numeric lines in any day tile.

## Motion and accessibility

- Motion communicates layer/state only: spring sheets, swipe reveal, short list fades, progress width transitions.
- Respect `prefers-reduced-motion`.
- Never rely on color alone: retain signs (+/−), labels, icons, and readable category names.
- Focus outline uses primary color at 3px with 2px offset.

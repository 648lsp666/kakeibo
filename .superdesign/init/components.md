# Shared UI primitives

Framework: React 19 + TypeScript. Styling is custom CSS variables with inline React styles and a few global utility classes.

## `src/components/ui/Icon.tsx` — Icon

Central rounded-line SVG icon registry. Props: `name`, `size`, `label`, `className`.

```tsx
export const ICON_NAMES = ['ledger','chart','category','settings','plus','close','chevron-left','chevron-right','download','upload','cloud','database','trash','warning','check','info','calendar','target','wallet','food','cart','transit','game','home','medical','book','briefcase','coins','gift','coffee','tea','plane','beauty','pet','phone','fitness','music','camera','more','mail','refresh','chevron-down','transfer'] as const
export type IconName = (typeof ICON_NAMES)[number]

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
```

The complete icon path registry must be sourced from `src/components/ui/Icon.tsx` for drafts.

## `src/components/ui/Sheet.tsx` — Sheet

Shared modal bottom sheet used for entry, month picker, confirmations, and settings forms.

```tsx
export function Sheet({ open, title, description, children, footer, onClose, closeDisabled = false, busy = false }: Props) {
  // Portal, escape-key, focus trap, and focus restoration logic omitted here; visual render is complete below.
  if (!open) return null
  return createPortal(
    <AnimatePresence>
      <motion.div role="presentation" onClick={() => { if (!closeDisabled) onClose() }}
        style={{ position:'fixed', inset:0, zIndex:100, background:'var(--color-overlay)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <motion.section ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined} aria-busy={busy}
          onClick={event => event.stopPropagation()} initial={{ y:'100%', opacity:.7 }} animate={{ y:0, opacity:1 }} exit={{ y:'100%', opacity:.7 }}
          transition={{ type:'spring', damping:30, stiffness:330 }}
          style={{ width:'100%', maxWidth:430, maxHeight:'88dvh', display:'flex', flexDirection:'column', background:'var(--color-bg-elevated)', border:'1px solid var(--color-border)', borderBottom:0, borderRadius:'24px 24px 0 0', boxShadow:'0 -16px 44px rgb(31 40 28 / 18%)', color:'var(--color-text)' }}>
          <div aria-hidden="true" style={{ width:42, height:4, borderRadius:999, background:'var(--color-border)', margin:'10px auto 2px' }} />
          <header style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 20px 12px' }}>
            <div style={{ flex:1 }}><h2 id={titleId} style={{ fontSize:18, fontWeight:850 }}>{title}</h2>
              {description && <p id={descriptionId} style={{ marginTop:4, color:'var(--color-text-secondary)', fontSize:12, lineHeight:1.5 }}>{description}</p>}</div>
            <button type="button" className="icon-button" aria-label="关闭" onClick={onClose} disabled={closeDisabled}><Icon name="close" /></button>
          </header>
          <div style={{ overflowY:'auto', padding:'4px 20px 20px' }}>{children}</div>
          {footer && <footer style={{ padding:'12px 20px max(16px, env(safe-area-inset-bottom))', borderTop:'1px solid var(--color-border)', background:'var(--color-bg-elevated)' }}>{footer}</footer>}
        </motion.section>
      </motion.div>
    </AnimatePresence>, document.body)
}
```

## `src/components/ui/Feedback.tsx` — InlineNotice, EmptyState, ConfirmDialog

```tsx
const noticeStyles = {
  success: { background:'var(--color-primary-soft)', color:'var(--color-income)', icon:'check' },
  warning: { background:'var(--color-bg-secondary)', color:'var(--color-warning)', icon:'warning' },
  error: { background:'var(--color-danger-soft)', color:'var(--color-expense)', icon:'warning' },
  info: { background:'var(--color-bg-secondary)', color:'var(--color-primary-strong)', icon:'info' },
}
export function InlineNotice({ tone, children }) {
  const style = noticeStyles[tone]
  return <div role={tone === 'error' ? 'alert' : 'status'} style={{ alignItems:'flex-start', background:style.background, borderRadius:'var(--radius-control)', color:style.color, display:'flex', fontSize:13, fontWeight:600, gap:10, lineHeight:1.5, padding:'12px 14px' }}><Icon name={style.icon} size={18}/><div style={{ color:'var(--color-text)', flex:1 }}>{children}</div></div>
}
export function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return <section style={{ color:'var(--color-text)', padding:'48px 24px', textAlign:'center' }}><div style={{ alignItems:'center', background:'var(--color-primary-soft)', borderRadius:999, color:'var(--color-primary-strong)', display:'inline-flex', height:56, justifyContent:'center', marginBottom:16, width:56 }}><Icon name={icon} size={28}/></div><h2 style={{ fontSize:17, fontWeight:800 }}>{title}</h2>{description && <p style={{ color:'var(--color-text-secondary)', fontSize:13, lineHeight:1.6, margin:'8px auto 0', maxWidth:280 }}>{description}</p>}{actionLabel && onAction && <button className="primary-button" style={{ marginTop:20 }}>{actionLabel}</button>}</section>
}
```

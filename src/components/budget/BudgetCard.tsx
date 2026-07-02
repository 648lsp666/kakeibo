import type { RuleWithStatus } from '../../hooks/useBudget'

interface Props {
  rs: RuleWithStatus
  onEdit: () => void
}

function fmt(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function BudgetCard({ rs, onEdit }: Props) {
  const { label, spending, limit, pct, isOver, subLabel } = rs
  const pctClamped = Math.min(pct, 1)
  const barColor = isOver ? '#e11d48' : pct >= 0.8 ? '#f97316' : '#3b82f6'

  return (
    <div
      style={{
        background: isOver ? 'rgba(225,29,72,0.05)' : pct >= 0.8 ? 'rgba(249,115,22,0.05)' : 'var(--color-bg-secondary)',
        borderRadius: 12,
        padding: '12px 14px',
        border: isOver ? '1.5px solid rgba(225,29,72,0.2)' : pct >= 0.8 ? '1.5px solid rgba(249,115,22,0.2)' : '1.5px solid transparent',
        cursor: 'pointer',
      }}
      onClick={onEdit}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: isOver ? '#e11d48' : 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {isOver ? '⚠️ ' : ''}{label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: barColor }}>{Math.round(pct * 100)}%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: isOver ? '#e11d48' : 'var(--color-text)' }}>
          ¥{fmt(spending)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>/ ¥{fmt(limit)}</span>
      </div>

      <div style={{ height: 5, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden', marginBottom: 7 }}>
        <div style={{
          height: '100%', width: `${pctClamped * 100}%`,
          borderRadius: 3, background: barColor, transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ fontSize: 11, color: isOver ? '#e11d48' : 'var(--color-text-secondary)', fontWeight: isOver ? 700 : 400 }}>
        {subLabel}
      </div>
    </div>
  )
}

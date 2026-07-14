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
  const isWarning = !isOver && pct >= 0.8
  const barColor = isOver ? 'var(--color-expense)' : isWarning ? 'var(--color-warning)' : 'var(--color-primary)'
  const statusLabel = isOver ? '已超预算' : isWarning ? '接近预算' : '预算正常'

  return (
    <button
      type="button"
      style={{
        background: isOver ? 'var(--color-danger-soft)' : isWarning ? 'var(--color-bg-secondary)' : 'var(--color-primary-soft)',
        borderRadius: 12,
        padding: '12px 14px',
        border: `1.5px solid ${barColor}`,
        color: 'var(--color-text)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
      onClick={onEdit}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: isOver ? 'var(--color-expense)' : 'var(--color-text-small)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label} · {statusLabel}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: barColor }}>{Math.round(pct * 100)}%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: isOver ? 'var(--color-expense)' : 'var(--color-text)' }}>
          ¥{fmt(spending)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-small)' }}>/ ¥{fmt(limit)}</span>
      </div>

      <div style={{ height: 5, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden', marginBottom: 7 }}>
        <div style={{
          height: '100%', width: `${pctClamped * 100}%`,
          borderRadius: 3, background: barColor, transition: 'width 0.4s ease',
        }} />
      </div>

      <div style={{ fontSize: 11, color: isOver ? 'var(--color-expense)' : 'var(--color-text-small)', fontWeight: isOver ? 700 : 400 }}>
        {subLabel}
      </div>
    </button>
  )
}

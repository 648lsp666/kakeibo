import type { MonthSummary } from '../../types'

interface Props {
  yearMonth: string   // 'YYYY-MM'
  summary: MonthSummary
  importButton: React.ReactNode
  onPrev: () => void
  onNext: () => void
  onPickMonth: () => void
}

function fmt(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function MonthHeader({ yearMonth, summary, importButton, onPrev, onNext, onPickMonth }: Props) {
  const [year, month] = yearMonth.split('-')

  return (
    <div style={{ background: 'var(--color-header-bg)', borderRadius: 16, padding: 16, margin: '12px 12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={onPrev} style={arrowBtn}>‹</button>
          <button onClick={onPickMonth} style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: 12, color: 'var(--color-text)', fontWeight: 700, letterSpacing: 0.5 }}>
            {year}年{month}月
          </button>
          <button onClick={onNext} style={arrowBtn}>›</button>
        </div>
        {importButton}
      </div>
      <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--color-text)', lineHeight: 1 }}>
        ¥{fmt(summary.expense)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>本月支出</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1, background: 'var(--color-stat-card)', borderRadius: 11, padding: 10, boxShadow: '0 1px 4px var(--color-stat-shadow)' }}>
          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>收入</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-income)' }}>¥{fmt(summary.income)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--color-stat-card)', borderRadius: 11, padding: 10, boxShadow: '0 1px 4px var(--color-stat-shadow)' }}>
          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>结余</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>¥{fmt(summary.balance)}</div>
        </div>
      </div>
    </div>
  )
}

const arrowBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: 18,
  color: 'var(--color-text-secondary)',
  fontWeight: 700,
  lineHeight: 1,
}

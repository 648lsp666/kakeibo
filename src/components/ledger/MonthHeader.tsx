import type { MonthSummary } from '../../types'
import { Icon } from '../ui/Icon'

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
    <header className="ledger-hero surface" style={{ borderRadius: 'var(--radius-hero)', padding: 18, margin: 'max(12px, env(safe-area-inset-top)) 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div>
          <p style={{ color: 'var(--color-primary-strong)', fontSize: 11, fontWeight: 800, letterSpacing: 1.4, marginBottom: 8 }}>慢慢生活</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button type="button" aria-label="上个月" onClick={onPrev} style={arrowBtn}><Icon name="chevron-left" size={18} /></button>
            <button type="button" aria-label={`选择月份，当前为${year}年${month}月`} onClick={onPickMonth} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 999, minHeight: 44, padding: '0 12px', cursor: 'pointer', fontSize: 12, color: 'var(--color-text)', fontWeight: 750, letterSpacing: 0.4 }}>
              {year}年{month}月
            </button>
            <button type="button" aria-label="下个月" onClick={onNext} style={arrowBtn}><Icon name="chevron-right" size={18} /></button>
          </div>
        </div>
        <div className="ledger-hero__secondary-action" style={{ flexShrink: 0 }}>{importButton}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-small)', fontWeight: 650, marginBottom: 5 }}>本月支出</div>
      <div style={{ fontSize: 'clamp(34px, 11vw, 46px)', fontWeight: 900, color: 'var(--color-text)', lineHeight: 1, letterSpacing: -1.5, overflowWrap: 'anywhere' }}>
        ¥{fmt(summary.expense)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 18 }}>
        <div style={{ minWidth: 0, background: 'var(--color-bg-secondary)', borderRadius: 14, padding: '12px 13px' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-small)', marginBottom: 5, fontWeight: 700, letterSpacing: .7 }}>收入</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-income-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>¥{fmt(summary.income)}</div>
        </div>
        <div style={{ minWidth: 0, background: 'var(--color-bg-secondary)', borderRadius: 14, padding: '12px 13px' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-small)', marginBottom: 5, fontWeight: 700, letterSpacing: .7 }}>结余</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>¥{fmt(summary.balance)}</div>
        </div>
      </div>
    </header>
  )
}

const arrowBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  minWidth: 44,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
}

import { useState } from 'react'
import type { BudgetRule, BudgetPeriod } from '../../types'
import { InlineNotice } from '../ui/Feedback'
import { Sheet } from '../ui/Sheet'

interface Props {
  current: BudgetRule | null
  onSave: (b: Omit<BudgetRule, 'id'>) => void
  onDelete: () => void
  onClose: () => void
}

const PERIODS: { id: BudgetPeriod; label: string; hint: string }[] = [
  { id: 'monthly', label: '月预算',  hint: '每月重置，自动算日均可用' },
  { id: 'yearly',  label: '年预算',  hint: '全年预算，均摊到月/日展示' },
  { id: 'custom',  label: '自定义',  hint: '指定开始和结束日期' },
]

export function BudgetSetupSheet({ current, onSave, onDelete, onClose }: Props) {
  const [amount, setAmount] = useState(current?.amount ? String(current.amount) : '')
  const [period, setPeriod] = useState<BudgetPeriod>(current?.period ?? 'monthly')
  const [startDate, setStartDate] = useState(current?.startDate ?? '')
  const [endDate, setEndDate] = useState(current?.endDate ?? '')
  const [error, setError] = useState('')

  const handleSave = () => {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError('请输入有效金额'); return }
    if (period === 'custom') {
      if (!startDate || !endDate) { setError('请选择开始和结束日期'); return }
      if (startDate >= endDate) { setError('结束日期须晚于开始日期'); return }
    }
    onSave({ amount: amt, period, startDate: period === 'custom' ? startDate : undefined, endDate: period === 'custom' ? endDate : undefined })
  }

  return (
    <Sheet
      open
      title={current ? '编辑预算' : '设置预算'}
      description="设置预算金额和统计周期。"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          {current && (
            <button
              type="button"
              onClick={onDelete}
              className="secondary-button"
              style={{ borderColor: 'var(--color-expense)', color: 'var(--color-expense-text)', flexShrink: 0 }}
            >
              删除
            </button>
          )}
          <button type="button" onClick={onClose} className="secondary-button" style={{ flex: 1 }}>
            取消
          </button>
          <button type="button" onClick={handleSave} className="primary-button" style={{ flex: 2 }}>
            保存
          </button>
        </div>
      }
    >
        {/* Amount */}
        <div style={fieldWrap}>
          <label htmlFor="budget-amount" style={fieldLabel}>预算金额</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>¥</span>
            <input
              id="budget-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError('') }}
              placeholder="0"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 34px',
                fontSize: 22, fontWeight: 800, background: 'var(--color-bg-secondary)',
                border: '2px solid transparent', borderRadius: 12, color: 'var(--color-text)',
                appearance: 'none',
              }}
            />
          </div>
        </div>

        {/* Period */}
        <div style={fieldWrap}>
          <div id="budget-period-label" style={fieldLabel}>预算周期</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PERIODS.map(p => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                aria-describedby="budget-period-label"
                onClick={() => setPeriod(p.id)}
                style={{
                  flex: 1, minHeight: 'var(--tap-size)', padding: '10px 0', borderRadius: 12, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: period === p.id ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                  color: period === p.id ? 'var(--color-on-primary)' : 'var(--color-text)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-small)', marginTop: 6 }}>
            {PERIODS.find(p => p.id === period)?.hint}
          </div>
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div style={fieldWrap}>
            <div style={fieldLabel}>日期范围</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input aria-label="开始日期" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setError('') }} style={dateInput} />
              <span style={{ color: 'var(--color-text-small)', fontSize: 13 }}>至</span>
              <input aria-label="结束日期" type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setError('') }} style={dateInput} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 12 }}><InlineNotice tone="error">{error}</InlineNotice></div>
        )}
    </Sheet>
  )
}

const fieldWrap: React.CSSProperties = { marginBottom: 18 }
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-small)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }
const dateInput: React.CSSProperties = { flex: 1, minHeight: 'var(--tap-size)', minWidth: 0, padding: '10px 8px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', fontSize: 13, color: 'var(--color-text)' }

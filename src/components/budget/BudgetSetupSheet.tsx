import { useState } from 'react'
import { motion } from 'framer-motion'
import type { BudgetRule, BudgetPeriod } from '../../types'

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
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--color-bg-card)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', marginBottom: 20 }}>
          {current ? '编辑预算' : '设置预算'}
        </div>

        {/* Amount */}
        <div style={fieldWrap}>
          <div style={fieldLabel}>预算金额</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>¥</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError('') }}
              placeholder="0"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 34px',
                fontSize: 22, fontWeight: 800, background: 'var(--color-bg-secondary)',
                border: '2px solid transparent', borderRadius: 12, color: 'var(--color-text)',
                outline: 'none', appearance: 'none',
              }}
            />
          </div>
        </div>

        {/* Period */}
        <div style={fieldWrap}>
          <div style={fieldLabel}>预算周期</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: period === p.id ? 'var(--color-tab-active)' : 'var(--color-bg-secondary)',
                  color: period === p.id ? 'var(--color-fab-text)' : 'var(--color-text)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
            {PERIODS.find(p => p.id === period)?.hint}
          </div>
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div style={fieldWrap}>
            <div style={fieldLabel}>日期范围</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateInput} />
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>至</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={dateInput} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: '#e11d48', marginBottom: 12, fontWeight: 600 }}>⚠️ {error}</div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {current && (
            <button onClick={onDelete} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#fee2e2', color: '#e11d48', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              删除
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: 'var(--color-bg-secondary)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', cursor: 'pointer' }}>
            取消
          </button>
          <button onClick={handleSave} style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'var(--color-tab-active)', fontSize: 14, fontWeight: 800, color: 'var(--color-fab-text)', cursor: 'pointer' }}>
            保存
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

const fieldWrap: React.CSSProperties = { marginBottom: 18 }
const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }
const dateInput: React.CSSProperties = { flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'var(--color-bg-secondary)', fontSize: 13, color: 'var(--color-text)', outline: 'none' }

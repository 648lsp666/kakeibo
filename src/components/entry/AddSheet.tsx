import { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { useTransactions } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { InlineNotice } from '../ui/Feedback'
import { Sheet } from '../ui/Sheet'
import { AmountInput } from './AmountInput'
import { CategoryPicker } from './CategoryPicker'
import type { TransactionType } from '../../types'

export function AddSheet() {
  const { isAddSheetOpen, closeAddSheet, currentMonth } = useAppStore()
  const { addTransaction } = useTransactions(currentMonth)
  const { categories } = useCategories()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState(false)
  const [categoryId, setCategoryId] = useState('sys-food')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const handleAmountChange = (value: string) => {
    setAmount(value)
    setAmountError(false)
  }

  const handleSave = async () => {
    const num = Math.round(parseFloat(amount) * 100) / 100
    if (!num || num <= 0) {
      setAmountError(true)
      return
    }

    await addTransaction({ amount: num, type, categoryId, note, date, source: 'manual' })
    setAmount('')
    setAmountError(false)
    setNote('')
    setCategoryId(type === 'expense' ? 'sys-food' : 'sys-salary')
    closeAddSheet()
  }

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    setCategoryId(newType === 'expense' ? 'sys-food' : 'sys-salary')
  }

  return (
    <Sheet
      open={isAddSheetOpen}
      title="记一笔"
      description="记录此刻的收入或支出"
      onClose={closeAddSheet}
      zIndex={100}
      footer={
        <button type="button" className="primary-button" onClick={handleSave} style={{ width: '100%' }}>
          保存记录
        </button>
      }
    >
      <div
        aria-label="收支类型"
        role="group"
        style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-control)', display: 'flex', marginBottom: 16, padding: 3 }}
      >
        {(['expense', 'income'] as TransactionType[]).map((itemType) => {
          const selected = type === itemType
          return (
            <button
              key={itemType}
              type="button"
              aria-pressed={selected}
              onClick={() => handleTypeChange(itemType)}
              style={{
                background: selected ? 'var(--color-primary)' : 'transparent',
                border: 'none',
                borderRadius: 11,
                color: selected ? 'var(--color-on-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                flex: 1,
                fontSize: 14,
                fontWeight: 700,
                minHeight: 44,
              }}
            >
              {itemType === 'expense' ? '支出' : '收入'}
            </button>
          )
        })}
      </div>

      <AmountInput value={amount} onChange={handleAmountChange} />

      {amountError && (
        <div style={{ marginTop: 12 }}>
          <InlineNotice tone="error">请输入大于 0 的金额</InlineNotice>
        </div>
      )}

      <div style={{ margin: '16px 0' }}>
        <CategoryPicker categories={categories} type={type} selectedId={categoryId} onSelect={setCategoryId} />
      </div>

      <label style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
        备注（选填）
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', color: 'var(--color-text)', display: 'block', fontSize: 14, marginTop: 6, minHeight: 44, outline: 'none', padding: '0 14px', width: '100%' }}
        />
      </label>

      <label style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: 12, fontWeight: 700 }}>
        日期
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', color: 'var(--color-text)', display: 'block', fontSize: 14, marginTop: 6, minHeight: 44, outline: 'none', padding: '0 14px', width: '100%' }}
        />
      </label>
    </Sheet>
  )
}

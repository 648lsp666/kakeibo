import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { useTransactions } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { AmountInput } from './AmountInput'
import { CategoryPicker } from './CategoryPicker'
import type { TransactionType } from '../../types'

export function AddSheet() {
  const { isAddSheetOpen, closeAddSheet, currentMonth } = useAppStore()
  const { addTransaction } = useTransactions(currentMonth)
  const { categories } = useCategories()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('sys-food')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const handleSave = async () => {
    const num = Math.round(parseFloat(amount) * 100) / 100
    if (!num || num <= 0) { alert('请输入金额'); return }
    await addTransaction({ amount: num, type, categoryId, note, date, source: 'manual' })
    setAmount('')
    setNote('')
    setCategoryId(type === 'expense' ? 'sys-food' : 'sys-salary')
    closeAddSheet()
  }

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    setCategoryId(newType === 'expense' ? 'sys-food' : 'sys-salary')
  }

  return (
    <AnimatePresence>
      {isAddSheetOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={closeAddSheet}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--color-bg-card)', borderRadius: '20px 20px 0 0', padding: 16 }}
            onClick={e => e.stopPropagation()}
          >
            {/* 收支切换 */}
            <div style={{ display: 'flex', background: 'var(--color-toggle-inactive)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {(['expense', 'income'] as TransactionType[]).map(t => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  style={{
                    flex: 1, padding: '9px 0',
                    background: type === t ? 'var(--color-toggle-active)' : 'transparent',
                    color: type === t ? 'var(--color-fab-text)' : 'var(--color-text-secondary)',
                    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {t === 'expense' ? '支出' : '收入'}
                </button>
              ))}
            </div>

            <AmountInput value={amount} onChange={setAmount} />

            <div style={{ margin: '14px 0' }}>
              <CategoryPicker categories={categories} type={type} selectedId={categoryId} onSelect={setCategoryId} />
            </div>

            <input
              placeholder="✏️ 备注（选填）"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ width: '100%', background: 'var(--color-input-bg)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--color-text)', marginBottom: 10, outline: 'none' }}
            />

            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', background: 'var(--color-input-bg)', border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--color-text)', marginBottom: 14, outline: 'none' }}
            />

            <button
              onClick={handleSave}
              style={{ width: '100%', background: 'var(--color-tab-active)', color: 'var(--color-fab-text)', border: 'none', borderRadius: 14, padding: '15px 0', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
            >
              保 存
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

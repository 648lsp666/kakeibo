import { motion } from 'framer-motion'
import type { Transaction } from '../../types'

interface Props {
  transactions: Transaction[]
  source: 'wechat' | 'alipay'
  duplicateIds?: Set<string>
  onConfirm: () => void
  onCancel: () => void
  importing: boolean
}

export function CSVPreviewSheet({ transactions, source, duplicateIds, onConfirm, onCancel, importing }: Props) {
  const label = source === 'wechat' ? '微信' : '支付宝'
  const expenses = transactions.filter(t => t.type === 'expense')
  const incomes = transactions.filter(t => t.type === 'income')
  const dupCount = duplicateIds?.size ?? 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--color-bg-card)', borderRadius: '20px 20px 0 0', padding: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)', marginBottom: 4 }}>
          {label}账单预览
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: dupCount > 0 ? 8 : 16 }}>
          共 {transactions.length} 条 · 支出 {expenses.length} 笔 · 收入 {incomes.length} 笔
        </div>

        {dupCount > 0 && (
          <div style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#c2680a', fontWeight: 600 }}>
            ⚠️ {dupCount} 条记录与手动录入的分类和金额相同，请确认是否为重复
          </div>
        )}

        <div style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: 16 }}>
          {transactions.slice(0, 20).map(tx => {
            const isDup = duplicateIds?.has(tx.id) ?? false
            return (
              <div
                key={tx.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 8px', borderRadius: isDup ? 8 : 0,
                  borderBottom: isDup ? 'none' : '1px solid var(--color-border)',
                  marginBottom: isDup ? 4 : 0,
                  background: isDup ? 'rgba(251,146,60,0.08)' : 'transparent',
                  border: isDup ? '1px solid rgba(251,146,60,0.25)' : undefined,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.note}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                    {tx.date}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  {isDup && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#c2680a', background: 'rgba(251,146,60,0.15)', padding: '1px 5px', borderRadius: 4 }}>
                      可能重复
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: tx.type === 'expense' ? 'var(--color-expense)' : 'var(--color-income)' }}>
                    {tx.type === 'expense' ? '-' : '+'}¥{tx.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            )
          })}
          {transactions.length > 20 && (
            <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              … 还有 {transactions.length - 20} 条
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', background: 'var(--color-bg-secondary)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', cursor: 'pointer' }}>
            取消
          </button>
          <button onClick={onConfirm} disabled={importing} style={{ flex: 2, padding: '12px 0', background: 'var(--color-tab-active)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, color: 'var(--color-fab-text)', cursor: 'pointer', opacity: importing ? 0.6 : 1 }}>
            {importing ? '导入中…' : `确认导入 ${transactions.length} 条`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

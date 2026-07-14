import type { Transaction } from '../../types'
import { InlineNotice } from '../ui/Feedback'
import { Sheet } from '../ui/Sheet'

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
  const expenses = transactions.filter((transaction) => transaction.type === 'expense')
  const incomes = transactions.filter((transaction) => transaction.type === 'income')
  const duplicateCount = duplicateIds?.size ?? 0

  return (
    <Sheet
      open
      title={`${label}账单预览`}
      description={`共 ${transactions.length} 条 · 支出 ${expenses.length} 笔 · 收入 ${incomes.length} 笔`}
      onClose={onCancel}
      zIndex={100}
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="secondary-button" onClick={onCancel} style={{ flex: 1 }}>
            取消
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={importing} style={{ flex: 2, opacity: importing ? 0.6 : 1 }}>
            {importing ? '导入中…' : `确认导入 ${transactions.length} 条`}
          </button>
        </div>
      }
    >
      {duplicateCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <InlineNotice tone="warning">
            {duplicateCount} 条记录与手动录入的分类和金额相同，请确认是否为重复
          </InlineNotice>
        </div>
      )}

      <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
        {transactions.slice(0, 20).map((transaction) => {
          const isDuplicate = duplicateIds?.has(transaction.id) ?? false
          return (
            <div
              key={transaction.id}
              style={{
                alignItems: 'center',
                background: isDuplicate ? 'var(--color-bg-secondary)' : 'transparent',
                border: isDuplicate ? '1px solid var(--color-warning)' : 'none',
                borderBottom: isDuplicate ? undefined : '1px solid var(--color-border)',
                borderRadius: isDuplicate ? 10 : 0,
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: isDuplicate ? 4 : 0,
                padding: '8px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--color-text-small)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {transaction.note}
                </div>
                <div style={{ color: 'var(--color-text-small)', fontSize: 10, marginTop: 2 }}>
                  {transaction.date}
                </div>
              </div>
              <div style={{ alignItems: 'center', display: 'flex', flexShrink: 0, gap: 6, marginLeft: 8 }}>
                {isDuplicate && (
                  <span style={{ background: 'var(--color-bg-card)', borderRadius: 5, color: 'var(--color-text-small)', fontSize: 9, fontWeight: 750, padding: '2px 6px' }}>
                    可能重复
                  </span>
                )}
                <span style={{ color: 'var(--color-text-small)', fontSize: 12, fontWeight: 750 }}>
                  {transaction.type === 'expense' ? '-' : '+'}¥{transaction.amount.toFixed(2)}
                </span>
              </div>
            </div>
          )
        })}
        {transactions.length > 20 && (
          <div style={{ color: 'var(--color-text-small)', fontSize: 12, padding: '10px 0', textAlign: 'center' }}>
            … 还有 {transactions.length - 20} 条
          </div>
        )}
      </div>
    </Sheet>
  )
}

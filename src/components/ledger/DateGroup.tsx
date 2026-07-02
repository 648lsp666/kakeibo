import type { DailyGroup, Category } from '../../types'
import { TransactionItem } from './TransactionItem'

interface Props {
  group: DailyGroup
  categories: Category[]
  onDelete: (id: string) => void
}

export function DateGroup({ group, categories, onDelete }: Props) {
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const isNeg = group.total < 0
  const dateObj = new Date(group.date + 'T00:00:00')
  const label = dateObj.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 6px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: isNeg ? 'var(--color-expense)' : 'var(--color-income)' }}>
          {isNeg ? '' : '+'}¥{Math.abs(group.total).toFixed(2)}
        </span>
      </div>
      {group.transactions.map(tx => (
        <TransactionItem key={tx.id} tx={tx} category={catMap[tx.categoryId]} onDelete={onDelete} />
      ))}
    </div>
  )
}

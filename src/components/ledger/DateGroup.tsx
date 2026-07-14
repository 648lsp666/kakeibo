import type { DailyGroup, Category } from '../../types'
import { TransactionItem } from './TransactionItem'

interface Props {
  group: DailyGroup
  categories: Category[]
  onDelete: (id: string) => void | Promise<void>
}

export function DateGroup({ group, categories, onDelete }: Props) {
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const isNeg = group.total < 0
  const dateObj = new Date(group.date + 'T00:00:00')
  const label = dateObj.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <section style={{ marginBottom: 10 }}>
      <header className="transaction-date-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 2px 7px' }}>
        <h2 className="transaction-date-heading__label" style={{ fontSize: 11, fontWeight: 750, color: 'var(--color-text-secondary)' }}>{label}</h2>
        <span className="transaction-date-heading__total" style={{ fontSize: 11, fontWeight: 750, color: isNeg ? 'var(--color-expense-text)' : 'var(--color-income-text)' }}>
          {isNeg ? '' : '+'}¥{Math.abs(group.total).toFixed(2)}
        </span>
      </header>
      <ul style={{ listStyle: 'none', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        {group.transactions.map(tx => (
          <TransactionItem key={tx.id} tx={tx} category={catMap[tx.categoryId]} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  )
}

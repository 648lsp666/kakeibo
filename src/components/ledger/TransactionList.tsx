import { motion, useReducedMotion } from 'framer-motion'
import type { Transaction, Category, DailyGroup } from '../../types'
import { DateGroup } from './DateGroup'
import { EmptyState } from '../ui/Feedback'
import { useAppStore } from '../../store/appStore'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  onDelete: (id: string) => void | Promise<void>
}

function groupByDate(txs: Transaction[]): DailyGroup[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const list = map.get(tx.date) ?? []
    list.push(tx)
    map.set(tx.date, list)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, transactions]) => ({
      date,
      transactions: transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      total: transactions.reduce((s, tx) => s + (tx.type === 'expense' ? -tx.amount : tx.amount), 0),
    }))
}

export function TransactionList({ transactions, categories, onDelete }: Props) {
  const groups = groupByDate(transactions)
  const prefersReducedMotion = useReducedMotion()

  if (groups.length === 0) {
    return (
      <div role="region" aria-label="交易记录" data-ledger-focus-target tabIndex={-1} style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <EmptyState
          icon="ledger"
          title="本月还没有记录"
          description="从一笔小花费开始，慢慢记下生活。"
          actionLabel="记一笔"
          onAction={useAppStore.getState().openAddSheet}
        />
      </div>
    )
  }

  return (
    <ol aria-label="交易记录" style={{ listStyle: 'none', padding: '8px 16px 20px', overflowY: 'auto', flex: 1 }}>
      {groups.map((g, i) => (
        <motion.li
          key={g.date}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { delay: i * 0.05, duration: 0.2 }}
        >
          <DateGroup group={g} categories={categories} onDelete={onDelete} />
        </motion.li>
      ))}
    </ol>
  )
}

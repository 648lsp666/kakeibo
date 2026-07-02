import { motion } from 'framer-motion'
import type { Transaction, Category, DailyGroup } from '../../types'
import { DateGroup } from './DateGroup'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  onDelete: (id: string) => void
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

  if (groups.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13, gap: 8, padding: 32 }}>
        <span style={{ fontSize: 40 }}>📭</span>
        <span>本月暂无记录</span>
        <span style={{ fontSize: 11 }}>点击右下角 + 添加第一笔</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 12px', overflowY: 'auto', flex: 1 }}>
      {groups.map((g, i) => (
        <motion.div
          key={g.date}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
        >
          <DateGroup group={g} categories={categories} onDelete={onDelete} />
        </motion.div>
      ))}
    </div>
  )
}

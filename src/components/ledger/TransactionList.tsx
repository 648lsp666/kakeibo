import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Transaction, Category, DailyGroup } from '../../types'
import { DateGroup } from './DateGroup'
import { ConfirmDialog, EmptyState } from '../ui/Feedback'
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
  const orderedTransactions = groups.flatMap(group => group.transactions)
  const prefersReducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLElement>(null)
  const deletingRef = useRef(false)
  const focusAfterCloseRef = useRef<string | null | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<{ transaction: Transaction; label: string; nextFocusId: string | null } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteCommitted, setDeleteCommitted] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const requestDelete = (id: string) => {
    const index = orderedTransactions.findIndex(transaction => transaction.id === id)
    if (index < 0) return
    const transaction = orderedTransactions[index]
    const categoryName = categories.find(category => category.id === transaction.categoryId)?.name
    const next = orderedTransactions[index + 1] ?? orderedTransactions[index - 1] ?? null
    setDeleteError('')
    setPendingDelete({ transaction, label: transaction.note || categoryName || '记录', nextFocusId: next?.id ?? null })
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      await onDelete(pendingDelete.transaction.id)
      setDeleteCommitted(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : '请稍后重试'
      setDeleteError(`删除失败：${message}`)
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const closeDelete = () => {
    if (deletingRef.current) return
    setDeleteError('')
    setPendingDelete(null)
  }

  useEffect(() => {
    if (!pendingDelete || !deleteCommitted) return
    if (transactions.some(transaction => transaction.id === pendingDelete.transaction.id)) return

    focusAfterCloseRef.current = pendingDelete.nextFocusId
    deletingRef.current = false
    setDeleting(false)
    setDeleteCommitted(false)
    setPendingDelete(null)
  }, [deleteCommitted, pendingDelete, transactions])

  useEffect(() => {
    if (pendingDelete || focusAfterCloseRef.current === undefined) return
    const focusId = focusAfterCloseRef.current
    const rowTarget = focusId
      ? Array.from(document.querySelectorAll<HTMLElement>('[data-transaction-delete-id]'))
        .find(element => element.dataset.transactionDeleteId === focusId)
      : null
    ;(rowTarget ?? containerRef.current)?.focus()
    focusAfterCloseRef.current = undefined
  }, [deleteCommitted, pendingDelete, transactions])

  const content = groups.length === 0 ? (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <EmptyState
          icon="ledger"
          title="本月还没有记录"
          description="从一笔小花费开始，慢慢记下生活。"
          actionLabel="记一笔"
          onAction={useAppStore.getState().openAddSheet}
        />
      </div>
  ) : (
    <ol aria-label="交易记录" style={{ listStyle: 'none', padding: '8px 16px 20px', overflowY: 'auto', flex: 1 }}>
      {groups.map((g, i) => (
        <motion.li
          key={g.date}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { delay: i * 0.05, duration: 0.2 }}
        >
          <DateGroup group={g} categories={categories} onDelete={requestDelete} />
        </motion.li>
      ))}
    </ol>
  )

  return (
    <>
      <section ref={containerRef} role="region" aria-label="交易记录" tabIndex={-1} style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
        {content}
      </section>
      {pendingDelete && createPortal(
        <ConfirmDialog
          open
          title="删除这条记录？"
          description={`确定删除「${pendingDelete.label}」吗？删除后无法恢复。`}
          confirmLabel={deleting ? '删除中…' : '确认删除'}
          tone="danger"
          busy={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onClose={closeDelete}
        />,
        document.body,
      )}
    </>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { transactionOps } from '../lib/db'
import { useAppStore } from '../store/appStore'
import type { Transaction, MonthSummary } from '../types'
import { nanoid } from 'nanoid'

type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

export function useTransactions(yearMonth: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const refreshSignal = useAppStore(s => s.refreshSignal)
  const triggerRefresh = useAppStore(s => s.triggerRefresh)

  const load = useCallback(async () => {
    const data = await transactionOps.getByMonth(yearMonth)
    setTransactions(data.sort((a, b) => b.date.localeCompare(a.date)))
  }, [yearMonth])

  useEffect(() => { load() }, [load, refreshSignal])

  const addTransaction = useCallback(async (input: NewTransaction) => {
    const now = new Date().toISOString()
    const tx: Transaction = { ...input, id: nanoid(), createdAt: now, updatedAt: now }
    await transactionOps.add(tx)
    triggerRefresh()
  }, [triggerRefresh])

  const deleteTransaction = useCallback(async (id: string) => {
    await transactionOps.delete(id)
    triggerRefresh()
  }, [triggerRefresh])

  const importTransactions = useCallback(async (txs: Transaction[]) => {
    const result = await transactionOps.addMany(txs)
    triggerRefresh()
    return result
  }, [triggerRefresh])

  const summary: MonthSummary = transactions.reduce(
    (acc, tx) => {
      if (tx.type === 'income') acc.income += tx.amount
      else acc.expense += tx.amount
      acc.balance = acc.income - acc.expense
      return acc
    },
    { income: 0, expense: 0, balance: 0 }
  )

  return { transactions, summary, addTransaction, deleteTransaction, importTransactions, refresh: triggerRefresh }
}

import { useState, useEffect } from 'react'
import { transactionOps } from '../lib/db'
import { useAppStore } from '../store/appStore'
import { detectMerchant } from '../lib/merchants'

export interface CategoryStat {
  categoryId: string
  amount: number
  pct: number   // 0-1
}

export interface MerchantStat {
  name: string
  amount: number
  pct: number   // 0-1
  count: number
}

export interface MonthTrend {
  yearMonth: string
  monthLabel: string
  expense: number
  income: number
}

export function useStats(yearMonth: string) {
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [merchantStats, setMerchantStats] = useState<MerchantStat[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<MonthTrend[]>([])
  const [totalExpense, setTotalExpense] = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const refreshSignal = useAppStore(s => s.refreshSignal)

  useEffect(() => {
    async function load() {
      const all = await transactionOps.getAll()

      // Category breakdown for current month (expense only)
      const monthTxs = all.filter(tx => tx.date.startsWith(yearMonth))
      const expTxs = monthTxs.filter(tx => tx.type === 'expense')
      const incTxs = monthTxs.filter(tx => tx.type === 'income')

      const expense = expTxs.reduce((s, t) => s + t.amount, 0)
      const income = incTxs.reduce((s, t) => s + t.amount, 0)
      setTotalExpense(expense)
      setTotalIncome(income)

      const catMap = new Map<string, number>()
      for (const tx of expTxs) {
        catMap.set(tx.categoryId, (catMap.get(tx.categoryId) ?? 0) + tx.amount)
      }
      const stats: CategoryStat[] = [...catMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([categoryId, amount]) => ({ categoryId, amount, pct: expense > 0 ? amount / expense : 0 }))
      setCategoryStats(stats)

      // Merchant breakdown
      const merchantMap = new Map<string, { amount: number; count: number }>()
      for (const tx of expTxs) {
        const merchant = detectMerchant(tx.note)
        if (!merchant) continue
        const cur = merchantMap.get(merchant) ?? { amount: 0, count: 0 }
        merchantMap.set(merchant, { amount: cur.amount + tx.amount, count: cur.count + 1 })
      }
      const mStats: MerchantStat[] = [...merchantMap.entries()]
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([name, { amount, count }]) => ({ name, amount, count, pct: expense > 0 ? amount / expense : 0 }))
      setMerchantStats(mStats)

      // 6-month trend ending at yearMonth
      const [y, m] = yearMonth.split('-').map(Number)
      const trend: MonthTrend[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(y, m - 1 - i)
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const txs = all.filter(tx => tx.date.startsWith(ym))
        trend.push({
          yearMonth: ym,
          monthLabel: `${d.getMonth() + 1}月`,
          expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
          income:  txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        })
      }
      setMonthlyTrend(trend)
    }
    load()
  }, [yearMonth, refreshSignal])

  return { categoryStats, merchantStats, monthlyTrend, totalExpense, totalIncome }
}

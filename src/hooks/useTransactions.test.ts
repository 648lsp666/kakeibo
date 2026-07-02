import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTransactions } from './useTransactions'
import { getDb } from '../lib/db'

beforeEach(async () => {
  const db = await getDb()
  await db.clear('transactions')
  await db.clear('categories')
})

describe('useTransactions', () => {
  it('starts empty', async () => {
    const { result } = renderHook(() => useTransactions('2026-06'))
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.transactions).toHaveLength(0)
  })

  it('adds a transaction and reflects in list', async () => {
    const { result } = renderHook(() => useTransactions('2026-06'))
    await act(async () => {
      await result.current.addTransaction({
        amount: 29,
        type: 'expense',
        categoryId: 'sys-food',
        note: '午饭',
        date: '2026-06-30',
        source: 'manual',
      })
    })
    // Wait for state update after triggerRefresh
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.transactions).toHaveLength(1)
    expect(result.current.transactions[0].amount).toBe(29)
  })

  it('computes monthly summary correctly', async () => {
    const { result } = renderHook(() => useTransactions('2026-06'))
    await act(async () => {
      await result.current.addTransaction({ amount: 5000, type: 'income', categoryId: 'sys-salary', note: '', date: '2026-06-01', source: 'manual' })
      await result.current.addTransaction({ amount: 100, type: 'expense', categoryId: 'sys-food', note: '', date: '2026-06-30', source: 'manual' })
    })
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(result.current.summary.income).toBe(5000)
    expect(result.current.summary.expense).toBe(100)
    expect(result.current.summary.balance).toBe(4900)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, transactionOps, categoryOps, syncConfigOps, budgetOps } from './db'
import { switchWorkspace } from '../sync/local-db'
import type { Transaction, Category, BudgetRule } from '../types'

const mockTx = (): Transaction => ({
  id: 'tx-1',
  amount: 29,
  type: 'expense',
  categoryId: 'cat-1',
  note: '午饭',
  date: '2026-06-30',
  source: 'manual',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const mockCat = (): Category => ({
  id: 'cat-1',
  name: '餐饮',
  icon: 'food',
  type: 'expense',
  isSystem: true,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
})

beforeEach(async () => {
  await switchWorkspace({ kind: 'anonymous' })
  const db = await getDb()
  await db.clear('transactions')
  await db.clear('categories')
  await db.clear('budgets')
  await db.clear('sync_config')
})

describe('transactionOps', () => {
  it('adds and retrieves a transaction', async () => {
    const tx = mockTx()
    await transactionOps.add(tx)
    const result = await transactionOps.getByMonth('2026-06')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tx-1')
  })

  it('skips duplicate externalId', async () => {
    const tx = { ...mockTx(), externalId: 'ext-001' }
    await transactionOps.add(tx)
    await transactionOps.add({ ...tx, id: 'tx-2' })
    const result = await transactionOps.getByMonth('2026-06')
    expect(result).toHaveLength(1)
  })

  it('deletes a transaction', async () => {
    await transactionOps.add(mockTx())
    await transactionOps.delete('tx-1')
    const result = await transactionOps.getByMonth('2026-06')
    expect(result).toHaveLength(0)
  })
})

describe('categoryOps', () => {
  it('adds and lists categories', async () => {
    await categoryOps.add(mockCat())
    const result = await categoryOps.list()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('餐饮')
  })

  it('deletes non-system category', async () => {
    const cat = { ...mockCat(), id: 'cat-2', isSystem: false }
    await categoryOps.add(cat)
    await categoryOps.delete('cat-2')
    const result = await categoryOps.list()
    expect(result).toHaveLength(0)
  })
})

describe('syncConfigOps', () => {
  it('sets and gets a config value', async () => {
    await syncConfigOps.set('webdav_url', 'https://dav.example.com')
    const val = await syncConfigOps.get('webdav_url')
    expect(val).toBe('https://dav.example.com')
  })

  it('returns undefined for missing key', async () => {
    const val = await syncConfigOps.get('missing_key')
    expect(val).toBeUndefined()
  })
})

describe('budgetOps', () => {
  it('lists, updates, and deletes first-class budget rows', async () => {
    const budget: BudgetRule = { id: 'budget-1', amount: 2000, period: 'monthly' }
    await budgetOps.add(budget)

    expect(await budgetOps.list()).toEqual([budget])

    await budgetOps.update({ ...budget, amount: 2500 })
    expect(await budgetOps.list()).toEqual([{ ...budget, amount: 2500 }])

    await budgetOps.delete(budget.id)
    expect(await budgetOps.list()).toEqual([])
  })
})

describe('active workspace binding', () => {
  it('resolves the active workspace for every operation', async () => {
    await switchWorkspace({ kind: 'user', userId: 'db-ops-a' })
    await transactionOps.add(mockTx())

    await switchWorkspace({ kind: 'user', userId: 'db-ops-b' })
    expect(await transactionOps.getAll()).toEqual([])

    await switchWorkspace({ kind: 'user', userId: 'db-ops-a' })
    expect(await transactionOps.getAll()).toHaveLength(1)
  })
})

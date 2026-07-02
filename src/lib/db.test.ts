import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, transactionOps, categoryOps, syncConfigOps } from './db'
import type { Transaction, Category } from '../types'

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
  emoji: '🍜',
  type: 'expense',
  isSystem: true,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
})

beforeEach(async () => {
  const db = await getDb()
  await db.clear('transactions')
  await db.clear('categories')
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

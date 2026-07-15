import type { BudgetRule, Category, Transaction } from '../types'
import { getActiveWorkspace } from '../sync/local-db'

export async function getDb() {
  return getActiveWorkspace()
}

export const transactionOps = {
  async add(tx: Transaction): Promise<void> {
    const db = await getDb()
    if (tx.externalId) {
      const existing = await db.getFromIndex('transactions', 'by-external', tx.externalId)
      if (existing) return
    }
    await db.put('transactions', tx)
  },

  async addMany(txs: Transaction[]): Promise<{ added: number; skipped: number }> {
    const db = await getDb()
    const dbTx = db.transaction('transactions', 'readwrite')
    const store = dbTx.objectStore('transactions')
    let added = 0, skipped = 0
    for (const tx of txs) {
      if (tx.externalId) {
        const existing = await store.index('by-external').get(tx.externalId)
        if (existing) { skipped++; continue }
      }
      await store.put(tx)
      added++
    }
    await dbTx.done
    return { added, skipped }
  },

  async getByMonth(yearMonth: string): Promise<Transaction[]> {
    const db = await getDb()
    const all = await db.getAllFromIndex('transactions', 'by-date')
    return all.filter(tx => tx.date.startsWith(yearMonth))
  },

  async update(tx: Transaction): Promise<void> {
    const db = await getDb()
    await db.put('transactions', { ...tx, updatedAt: new Date().toISOString() })
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('transactions', id)
  },

  async getAll(): Promise<Transaction[]> {
    const db = await getDb()
    return db.getAll('transactions')
  },
}

export const categoryOps = {
  async add(cat: Category): Promise<void> {
    const db = await getDb()
    await db.put('categories', cat)
  },

  async list(): Promise<Category[]> {
    const db = await getDb()
    return db.getAllFromIndex('categories', 'by-sort')
  },

  async update(cat: Category): Promise<void> {
    const db = await getDb()
    await db.put('categories', cat)
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('categories', id)
  },
}

export const syncConfigOps = {
  async set(key: string, value: string): Promise<void> {
    const db = await getDb()
    await db.put('sync_config', { key, value })
  },

  async get(key: string): Promise<string | undefined> {
    const db = await getDb()
    const row = await db.get('sync_config', key)
    return row?.value
  },

  async getAll(): Promise<Record<string, string>> {
    const db = await getDb()
    const rows = await db.getAll('sync_config')
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  },

  async delete(key: string): Promise<void> {
    const db = await getDb()
    await db.delete('sync_config', key)
  },
}

function withoutRevision(row: BudgetRule & { revision: number }): BudgetRule {
  const { revision: _revision, ...budget } = row
  return budget
}

export const budgetOps = {
  async list(): Promise<BudgetRule[]> {
    const db = await getDb()
    const rows = await db.getAll('budgets')
    return rows.map(withoutRevision)
  },

  async add(rule: BudgetRule): Promise<void> {
    const db = await getDb()
    await db.put('budgets', { ...rule, revision: 0 })
  },

  async update(rule: BudgetRule): Promise<void> {
    const db = await getDb()
    const existing = await db.get('budgets', rule.id)
    await db.put('budgets', { ...rule, revision: existing?.revision ?? 0 })
  },

  async delete(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('budgets', id)
  },
}

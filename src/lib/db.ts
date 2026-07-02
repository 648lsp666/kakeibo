import { openDB, IDBPDatabase } from 'idb'
import type { Transaction, Category } from '../types'

interface KakeiboSchema {
  transactions: { key: string; value: Transaction; indexes: { 'by-date': string; 'by-external': string } }
  categories: { key: string; value: Category; indexes: { 'by-sort': number } }
  sync_config: { key: string; value: { key: string; value: string } }
}

let _db: IDBPDatabase<KakeiboSchema> | null = null

export async function getDb() {
  if (_db) return _db
  _db = await openDB<KakeiboSchema>('kakeibo', 1, {
    upgrade(db) {
      const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
      txStore.createIndex('by-date', 'date')
      txStore.createIndex('by-external', 'externalId', { unique: false })
      const catStore = db.createObjectStore('categories', { keyPath: 'id' })
      catStore.createIndex('by-sort', 'sortOrder')
      db.createObjectStore('sync_config', { keyPath: 'key' })
    },
  })
  return _db
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
    let added = 0, skipped = 0
    for (const tx of txs) {
      if (tx.externalId) {
        const db = await getDb()
        const existing = await db.getFromIndex('transactions', 'by-external', tx.externalId)
        if (existing) { skipped++; continue }
      }
      await transactionOps.add(tx)
      added++
    }
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

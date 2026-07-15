import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb'
import type { BudgetRule, Category, Transaction } from '../types'
import type { EntityType, OutboxMutation, RemoteChange, SyncPayload } from './contracts'

interface SyncConfigRow {
  key: string
  value: string
}

interface SyncMetaRow {
  key: string
  value: string
}

interface BudgetRow extends BudgetRule {
  revision: number
}

export interface KakeiboSchemaV2 extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string; 'by-external': string }
  }
  categories: {
    key: string
    value: Category
    indexes: { 'by-sort': number }
  }
  budgets: { key: string; value: BudgetRow }
  sync_config: { key: string; value: SyncConfigRow }
  outbox: {
    key: string
    value: OutboxMutation
    indexes: { 'by-state': OutboxMutation['state']; 'by-entity': [EntityType, string] }
  }
  sync_meta: { key: string; value: SyncMetaRow }
}

export type WorkspaceStore =
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'sync_config'
  | 'outbox'
  | 'sync_meta'

export type WorkspaceId = { kind: 'anonymous' } | { kind: 'user'; userId: string }

export function workspaceDbName(id: WorkspaceId): string {
  return id.kind === 'anonymous' ? 'kakeibo' : `kakeibo-user-${id.userId}`
}

function createVersionOneStores(db: IDBPDatabase<KakeiboSchemaV2>): void {
  const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
  transactions.createIndex('by-date', 'date')
  transactions.createIndex('by-external', 'externalId', { unique: false })
  const categories = db.createObjectStore('categories', { keyPath: 'id' })
  categories.createIndex('by-sort', 'sortOrder')
  db.createObjectStore('sync_config', { keyPath: 'key' })
}

export async function openWorkspace(id: WorkspaceId): Promise<IDBPDatabase<KakeiboSchemaV2>> {
  return openDB<KakeiboSchemaV2>(workspaceDbName(id), 2, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) createVersionOneStores(db)
      if (oldVersion >= 2) return

      db.createObjectStore('budgets', { keyPath: 'id' })
      const outbox = db.createObjectStore('outbox', { keyPath: 'mutationId' })
      outbox.createIndex('by-state', 'state')
      outbox.createIndex('by-entity', ['entityType', 'entityId'])
      db.createObjectStore('sync_meta', { keyPath: 'key' })

      const config = tx.objectStore('sync_config')
      const budgets = tx.objectStore('budgets')
      void config.get('budgets').then(async legacy => {
        if (!legacy) return

        let rules: BudgetRule[]
        try {
          rules = JSON.parse(legacy.value) as BudgetRule[]
          if (!Array.isArray(rules)) return
        } catch {
          return
        }

        for (const rule of rules) {
          await budgets.put({ ...rule, revision: 0 })
        }
        await config.delete('budgets')
      })
    },
  })
}

let activeWorkspace: IDBPDatabase<KakeiboSchemaV2> | null = null
let openingWorkspace: Promise<IDBPDatabase<KakeiboSchemaV2>> | null = null

export async function switchWorkspace(id: WorkspaceId): Promise<void> {
  activeWorkspace?.close()
  activeWorkspace = null
  openingWorkspace = null

  const db = await openWorkspace(id)
  activeWorkspace = db
}

export async function getActiveWorkspace(): Promise<IDBPDatabase<KakeiboSchemaV2>> {
  if (activeWorkspace) return activeWorkspace
  if (!openingWorkspace) openingWorkspace = openWorkspace({ kind: 'anonymous' })

  try {
    activeWorkspace = await openingWorkspace
    return activeWorkspace
  } finally {
    openingWorkspace = null
  }
}

export async function withWorkspaceWrite<T, Stores extends Array<WorkspaceStore>>(
  stores: Stores,
  run: (
    tx: IDBPTransaction<
      KakeiboSchemaV2,
      Stores,
      'readwrite'
    >,
  ) => Promise<T>,
): Promise<T> {
  const db = await getActiveWorkspace()
  const tx = db.transaction(stores, 'readwrite')

  try {
    const result = await run(tx)
    await tx.done
    return result
  } catch (error) {
    try {
      tx.abort()
      await tx.done
    } catch {
      // Preserve the callback or request error that caused the rollback.
    }
    throw error
  }
}

export const outboxOps = {
  async put(mutation: OutboxMutation): Promise<void> {
    const db = await getActiveWorkspace()
    await db.put('outbox', mutation)
  },

  async add(mutation: OutboxMutation): Promise<void> {
    await outboxOps.put(mutation)
  },

  async get(mutationId: string): Promise<OutboxMutation | undefined> {
    const db = await getActiveWorkspace()
    return db.get('outbox', mutationId)
  },

  async pending(limit?: number): Promise<OutboxMutation[]> {
    const db = await getActiveWorkspace()
    const pending = await db.getAllFromIndex('outbox', 'by-state', 'pending')
    pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return limit === undefined ? pending : pending.slice(0, limit)
  },

  async list(): Promise<OutboxMutation[]> {
    const db = await getActiveWorkspace()
    return db.getAll('outbox')
  },

  async delete(mutationId: string): Promise<void> {
    const db = await getActiveWorkspace()
    await db.delete('outbox', mutationId)
  },

  async countPending(): Promise<number> {
    const db = await getActiveWorkspace()
    return db.countFromIndex('outbox', 'by-state', 'pending')
  },
}

export const syncMetaOps = {
  async set(key: string, value: string): Promise<void> {
    const db = await getActiveWorkspace()
    await db.put('sync_meta', { key, value })
  },

  async get(key: string): Promise<string | undefined> {
    const db = await getActiveWorkspace()
    return (await db.get('sync_meta', key))?.value
  },

  async getAll(): Promise<Record<string, string>> {
    const db = await getActiveWorkspace()
    const rows = await db.getAll('sync_meta')
    return Object.fromEntries(rows.map(row => [row.key, row.value]))
  },

  async delete(key: string): Promise<void> {
    const db = await getActiveWorkspace()
    await db.delete('sync_meta', key)
  },
}

function storeFor(entityType: EntityType): 'transactions' | 'categories' | 'budgets' {
  if (entityType === 'transaction') return 'transactions'
  if (entityType === 'category') return 'categories'
  return 'budgets'
}

function rowFor(entityType: EntityType, payload: SyncPayload, revision: number): SyncPayload | BudgetRow {
  return entityType === 'budget' ? { ...payload as BudgetRule, revision } : payload
}

export async function applyRemoteChanges(changes: RemoteChange[]): Promise<void> {
  await withWorkspaceWrite(
    ['transactions', 'categories', 'budgets', 'outbox'],
    async tx => {
      for (const change of changes) {
        const storeName = storeFor(change.entityType)
        const store = tx.objectStore(storeName) as IDBPTransaction<KakeiboSchemaV2, ['transactions'], 'readwrite'>['store']
        if (change.record && change.operation !== 'delete') {
          await store.put(rowFor(change.entityType, change.record, change.revision) as Transaction)
        } else {
          await store.delete(change.entityId)
        }

        const entityMutations = await tx.objectStore('outbox').index('by-entity').getAll([
          change.entityType,
          change.entityId,
        ])
        const pending = entityMutations
          .filter(mutation => mutation.state === 'pending')
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

        for (const mutation of pending) {
          if (mutation.payload && mutation.operation !== 'delete') {
            await store.put(rowFor(change.entityType, mutation.payload, change.revision) as Transaction)
          } else {
            await store.delete(change.entityId)
          }
        }
      }
    },
  )
}

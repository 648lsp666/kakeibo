import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb'
import type { BudgetRule, Category, Transaction } from '../types'
import type { EntityType, PendingOperation } from './contracts'

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

interface StoredPendingOperation extends PendingOperation {
  enqueueOrder: number
}

export interface KakeiboSchemaV3 extends DBSchema {
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
    value: StoredPendingOperation
    indexes: {
      'by-state': PendingOperation['state']
      'by-entity': [EntityType, string]
      'by-order': number
    }
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

export interface WorkspaceSnapshot {
  db: IDBPDatabase<KakeiboSchemaV3>
  generation: number
  id: WorkspaceId
}

export function workspaceDbName(id: WorkspaceId): string {
  return id.kind === 'anonymous' ? 'kakeibo' : `kakeibo-user-${id.userId}`
}

function createVersionOneStores(db: IDBPDatabase<KakeiboSchemaV3>): void {
  const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
  transactions.createIndex('by-date', 'date')
  transactions.createIndex('by-external', 'externalId', { unique: false })
  const categories = db.createObjectStore('categories', { keyPath: 'id' })
  categories.createIndex('by-sort', 'sortOrder')
  db.createObjectStore('sync_config', { keyPath: 'key' })
}

function createVersionThreeOutbox(db: IDBPDatabase<KakeiboSchemaV3>): void {
  const outbox = db.createObjectStore('outbox', { keyPath: 'operationId' })
  outbox.createIndex('by-state', 'state')
  outbox.createIndex('by-entity', ['entityType', 'entityId'])
  outbox.createIndex('by-order', 'enqueueOrder')
}

export async function openWorkspace(id: WorkspaceId): Promise<IDBPDatabase<KakeiboSchemaV3>> {
  return openDB<KakeiboSchemaV3>(workspaceDbName(id), 3, {
    upgrade(db, oldVersion, _newVersion, tx) {
      void tx.done.then(
        () => undefined,
        () => undefined,
      )
      if (oldVersion < 1) createVersionOneStores(db)

      if (oldVersion < 2) {
        db.createObjectStore('budgets', { keyPath: 'id' })
        db.createObjectStore('sync_meta', { keyPath: 'key' })

        const config = tx.objectStore('sync_config')
        const budgets = tx.objectStore('budgets')
        void (async () => {
          try {
            const legacy = await config.get('budgets')
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
          } catch {
            try {
              tx.abort()
            } catch {
              // A failed IndexedDB request may already have aborted the upgrade.
            }
          }
        })()
      }

      if (oldVersion < 3) {
        if (db.objectStoreNames.contains('outbox')) db.deleteObjectStore('outbox')
        createVersionThreeOutbox(db)
      }
    },
  })
}

type WorkspaceOpener = (id: WorkspaceId) => Promise<IDBPDatabase<KakeiboSchemaV3>>

interface OpeningWorkspace {
  generation: number
  id: WorkspaceId
  promise: Promise<IDBPDatabase<KakeiboSchemaV3> | null>
}

let activeWorkspace: IDBPDatabase<KakeiboSchemaV3> | null = null
let activeWorkspaceId: WorkspaceId | null = null
let targetWorkspaceId: WorkspaceId | null = null
let workspaceGeneration = 0
let openingWorkspace: OpeningWorkspace | null = null
let workspaceOpener: WorkspaceOpener = openWorkspace

function sameWorkspace(left: WorkspaceId | null, right: WorkspaceId): boolean {
  if (!left || left.kind !== right.kind) return false
  return left.kind === 'anonymous'
    || left.userId === (right as Extract<WorkspaceId, { kind: 'user' }>).userId
}

function resetWorkspaceState(): void {
  workspaceGeneration++
  targetWorkspaceId = null
  activeWorkspaceId = null
  activeWorkspace?.close()
  activeWorkspace = null
  openingWorkspace = null
}

async function openTarget(
  id: WorkspaceId,
  generation: number,
): Promise<IDBPDatabase<KakeiboSchemaV3> | null> {
  if (openingWorkspace?.generation === generation && sameWorkspace(openingWorkspace.id, id)) {
    return openingWorkspace.promise
  }

  const promise = workspaceOpener(id)
    .then(db => {
      if (workspaceGeneration !== generation || !sameWorkspace(targetWorkspaceId, id)) {
        db.close()
        return null
      }

      activeWorkspace?.close()
      activeWorkspace = db
      activeWorkspaceId = id
      return db
    })
    .catch(error => {
      if (workspaceGeneration !== generation || !sameWorkspace(targetWorkspaceId, id)) return null
      throw error
    })
    .finally(() => {
      if (openingWorkspace?.generation === generation) openingWorkspace = null
    })

  openingWorkspace = { generation, id, promise }
  return promise
}

export async function switchWorkspace(id: WorkspaceId): Promise<void> {
  const generation = ++workspaceGeneration
  targetWorkspaceId = id
  activeWorkspace?.close()
  activeWorkspace = null
  activeWorkspaceId = null

  await openTarget(id, generation)
}

export async function getActiveWorkspace(): Promise<IDBPDatabase<KakeiboSchemaV3>> {
  while (true) {
    if (activeWorkspace && targetWorkspaceId && sameWorkspace(activeWorkspaceId, targetWorkspaceId)) {
      return activeWorkspace
    }

    if (!targetWorkspaceId) {
      targetWorkspaceId = { kind: 'anonymous' }
      workspaceGeneration++
    }

    const id = targetWorkspaceId
    const generation = workspaceGeneration
    const db = await openTarget(id, generation)
    if (db) return db
  }
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const db = await getActiveWorkspace()
  if (!activeWorkspaceId) throw new Error('Active workspace has no identity')
  return { db, generation: workspaceGeneration, id: activeWorkspaceId }
}

export function isWorkspaceCurrent(snapshot: WorkspaceSnapshot): boolean {
  return snapshot.db === activeWorkspace
    && snapshot.generation === workspaceGeneration
    && sameWorkspace(activeWorkspaceId, snapshot.id)
}

export function setWorkspaceOpenerForTests(opener: WorkspaceOpener): () => void {
  resetWorkspaceState()
  workspaceOpener = opener
  return () => {
    resetWorkspaceState()
    workspaceOpener = openWorkspace
  }
}

export async function withWorkspaceWrite<T, Stores extends Array<WorkspaceStore>>(
  stores: Stores,
  run: (tx: IDBPTransaction<KakeiboSchemaV3, Stores, 'readwrite'>) => Promise<T>,
): Promise<T> {
  return withWorkspaceSnapshotWrite(await getWorkspaceSnapshot(), stores, run)
}

export async function withWorkspaceSnapshotWrite<T, Stores extends Array<WorkspaceStore>>(
  snapshot: WorkspaceSnapshot,
  stores: Stores,
  run: (tx: IDBPTransaction<KakeiboSchemaV3, Stores, 'readwrite'>) => Promise<T>,
): Promise<T> {
  if (!isWorkspaceCurrent(snapshot)) throw new Error('Workspace snapshot is no longer active')

  const tx = snapshot.db.transaction(stores, 'readwrite')
  const completion = tx.done.then(
    () => ({ ok: true as const }),
    error => ({ ok: false as const, error }),
  )

  try {
    const result = await run(tx)
    const completed = await completion
    if (!completed.ok) throw completed.error
    return result
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // The transaction may already have aborted after a failed request.
    }
    await completion
    throw error
  }
}

/**
 * Restores a manual WebDAV backup into the anonymous, local-only ledger.
 * This deliberately bypasses the domain repository: recovery must never
 * enqueue cloud operations or wake automatic sync.
 */
export async function importAnonymousWebDavTransactions(
  records: Transaction[],
): Promise<{ added: number; updated: number }> {
  const workspace = await getWorkspaceSnapshot()
  if (workspace.id.kind !== 'anonymous') {
    throw new Error('请先退出账号并在本机模式恢复 WebDAV 备份')
  }

  return withWorkspaceSnapshotWrite(workspace, ['transactions'], async tx => {
    const transactions = tx.objectStore('transactions')
    let added = 0
    let updated = 0

    for (const record of records) {
      const existing = await transactions.get(record.id)
      if (!existing) {
        await transactions.put(record)
        added++
      } else if (record.updatedAt > existing.updatedAt) {
        await transactions.put(record)
        updated++
      }
    }

    return { added, updated }
  })
}

function withoutEnqueueOrder(operation: StoredPendingOperation): PendingOperation {
  const { enqueueOrder: _enqueueOrder, ...pending } = operation
  return pending
}

export const outboxOps = {
  async put(operation: PendingOperation): Promise<void> {
    await withWorkspaceWrite(['outbox', 'sync_meta'], async tx => {
      const outbox = tx.objectStore('outbox')
      const existing = await outbox.get(operation.operationId)
      if (existing) {
        await outbox.put({ ...operation, enqueueOrder: existing.enqueueOrder })
        return
      }

      const meta = tx.objectStore('sync_meta')
      const current = await meta.get('outbox_sequence')
      const enqueueOrder = Number.parseInt(current?.value ?? '0', 10) + 1
      await outbox.add({ ...operation, enqueueOrder })
      await meta.put({ key: 'outbox_sequence', value: String(enqueueOrder) })
    })
  },

  async add(operation: PendingOperation): Promise<void> {
    await withWorkspaceWrite(['outbox', 'sync_meta'], async tx => {
      const meta = tx.objectStore('sync_meta')
      const current = await meta.get('outbox_sequence')
      const enqueueOrder = Number.parseInt(current?.value ?? '0', 10) + 1
      await tx.objectStore('outbox').add({ ...operation, enqueueOrder })
      await meta.put({ key: 'outbox_sequence', value: String(enqueueOrder) })
    })
  },

  async get(operationId: string): Promise<PendingOperation | undefined> {
    const db = await getActiveWorkspace()
    const operation = await db.get('outbox', operationId)
    return operation && withoutEnqueueOrder(operation)
  },

  async pending(limit?: number): Promise<PendingOperation[]> {
    const db = await getActiveWorkspace()
    const operations = await db.getAllFromIndex('outbox', 'by-order')
    const pending = operations
      .filter(operation => operation.state === 'pending')
      .map(withoutEnqueueOrder)
    return limit === undefined ? pending : pending.slice(0, limit)
  },

  async list(): Promise<PendingOperation[]> {
    const db = await getActiveWorkspace()
    return (await db.getAllFromIndex('outbox', 'by-order')).map(withoutEnqueueOrder)
  },

  async delete(operationId: string): Promise<void> {
    const db = await getActiveWorkspace()
    await db.delete('outbox', operationId)
  },

  async countPending(): Promise<number> {
    const db = await getActiveWorkspace()
    return db.countFromIndex('outbox', 'by-state', 'pending')
  },

  async isolated(): Promise<PendingOperation[]> {
    const db = await getActiveWorkspace()
    return (await db.getAllFromIndex('outbox', 'by-order'))
      .filter(operation => operation.state === 'isolated')
      .map(withoutEnqueueOrder)
  },

  async retryIsolated(): Promise<number> {
    const timestamp = new Date().toISOString()
    return withWorkspaceWrite(['outbox'], async tx => {
      const outbox = tx.objectStore('outbox')
      const operations = await outbox.index('by-state').getAll('isolated')
      for (const operation of operations) {
        await outbox.put({ ...operation, state: 'pending', attemptCount: 0, nextAttemptAt: timestamp, lastError: undefined })
      }
      return operations.length
    })
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

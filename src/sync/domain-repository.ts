import { nanoid } from 'nanoid'
import type { BudgetRule, Category, Transaction } from '../types'
import type { CloudRecord, EntityType, PendingOperation, SyncPayload } from './contracts'
import { getWorkspaceSnapshot, withWorkspaceWrite } from './local-db'
import { emitSyncWake } from './wake-bus'

export interface DomainSnapshot {
  transactions: Transaction[]
  categories: Category[]
  budgets: BudgetRule[]
}

export interface DomainRepository {
  upsert(entityType: EntityType, payload: SyncPayload): Promise<void>
  remove(entityType: EntityType, entityId: string): Promise<void>
  importTransactions(records: Transaction[]): Promise<{ added: number; skipped: number }>
  applyCloudRecords(records: CloudRecord[]): Promise<void>
  exportSnapshot(): Promise<DomainSnapshot>
}

interface DomainRepositoryOptions {
  operationId?: () => string
  now?: () => Date
}

function storeName(entityType: EntityType): 'transactions' | 'categories' | 'budgets' {
  if (entityType === 'transaction') return 'transactions'
  if (entityType === 'category') return 'categories'
  return 'budgets'
}

function storedPayload(entityType: EntityType, payload: SyncPayload): SyncPayload | (BudgetRule & { revision: number }) {
  return entityType === 'budget' ? { ...(payload as BudgetRule), revision: 0 } : payload
}

function stripBudgetRevision(row: BudgetRule & { revision: number }): BudgetRule {
  const { revision: _revision, ...budget } = row
  return budget
}

export function createDomainRepository(options: DomainRepositoryOptions = {}): DomainRepository {
  const createOperationId = options.operationId ?? nanoid
  const now = options.now ?? (() => new Date())

  const pendingOperation = (
    entityType: EntityType,
    entityId: string,
    operation: PendingOperation['operation'],
    payload: SyncPayload | null,
  ): PendingOperation => {
    const timestamp = now().toISOString()
    return {
      operationId: createOperationId(),
      entityType,
      entityId,
      operation,
      payload,
      createdAt: timestamp,
      attemptCount: 0,
      nextAttemptAt: timestamp,
      state: 'pending',
    }
  }

  return {
    async upsert(entityType, payload) {
      const store = storeName(entityType)
      if (entityType === 'category' && (payload as Category).isSystem) {
        await withWorkspaceWrite(['categories'], async tx => {
          await tx.objectStore('categories').put(payload as Category)
        })
        return
      }

      const operation = pendingOperation(entityType, payload.id, 'upsert', payload)
      await withWorkspaceWrite([store, 'outbox', 'sync_meta'], async tx => {
        await tx.objectStore(store).put(storedPayload(entityType, payload) as never)
        const meta = tx.objectStore('sync_meta')
        const current = await meta.get('outbox_sequence')
        const enqueueOrder = Number.parseInt(current?.value ?? '0', 10) + 1
        await tx.objectStore('outbox').add({ ...operation, enqueueOrder })
        await meta.put({ key: 'outbox_sequence', value: String(enqueueOrder) })
      })
      emitSyncWake('local-write')
    },

    async remove(entityType, entityId) {
      const store = storeName(entityType)
      const operation = pendingOperation(entityType, entityId, 'delete', null)
      const synced = await withWorkspaceWrite([store, 'outbox', 'sync_meta'], async tx => {
        if (entityType === 'category') {
          const existing = await tx.objectStore('categories').get(entityId)
          if (existing?.isSystem) {
            await tx.objectStore('categories').delete(entityId)
            return false
          }
        }
        await tx.objectStore(store).delete(entityId)
        const meta = tx.objectStore('sync_meta')
        const current = await meta.get('outbox_sequence')
        const enqueueOrder = Number.parseInt(current?.value ?? '0', 10) + 1
        await tx.objectStore('outbox').add({ ...operation, enqueueOrder })
        await meta.put({ key: 'outbox_sequence', value: String(enqueueOrder) })
        return true
      })
      if (synced) emitSyncWake('local-write')
    },

    async importTransactions(records) {
      const result = await withWorkspaceWrite(
        ['transactions', 'outbox', 'sync_meta'],
        async tx => {
          const transactions = tx.objectStore('transactions')
          const outbox = tx.objectStore('outbox')
          const meta = tx.objectStore('sync_meta')
          const current = await meta.get('outbox_sequence')
          let enqueueOrder = Number.parseInt(current?.value ?? '0', 10)
          let added = 0
          let skipped = 0

          for (const record of records) {
            if (record.externalId) {
              const existing = await transactions.index('by-external').get(record.externalId)
              if (existing) {
                skipped++
                continue
              }
            }

            await transactions.put(record)
            enqueueOrder++
            await outbox.add({
              ...pendingOperation('transaction', record.id, 'upsert', record),
              enqueueOrder,
            })
            added++
          }

          if (added > 0) {
            await meta.put({ key: 'outbox_sequence', value: String(enqueueOrder) })
          }
          return { added, skipped }
        },
      )
      if (result.added > 0) emitSyncWake('local-write')
      return result
    },

    async applyCloudRecords(records) {
      const { db } = await getWorkspaceSnapshot()
      const tx = db.transaction(['transactions', 'categories', 'budgets', 'outbox'], 'readwrite')

      for (const cloudRecord of records) {
        const store = tx.objectStore(storeName(cloudRecord.entityType))
        if (cloudRecord.deletedAt || !cloudRecord.record) {
          await store.delete(cloudRecord.entityId)
        } else {
          await store.put(storedPayload(cloudRecord.entityType, cloudRecord.record) as never)
        }
      }

      const operations = await tx.objectStore('outbox').index('by-order').getAll()
      for (const operation of operations) {
        if (operation.state !== 'pending') continue
        const store = tx.objectStore(storeName(operation.entityType))
        if (operation.operation === 'delete' || !operation.payload) {
          await store.delete(operation.entityId)
        } else {
          await store.put(storedPayload(operation.entityType, operation.payload) as never)
        }
      }

      await tx.done
    },

    async exportSnapshot() {
      const { db } = await getWorkspaceSnapshot()
      const tx = db.transaction(['transactions', 'categories', 'budgets'])
      const [transactions, categories, budgetRows] = await Promise.all([
        tx.objectStore('transactions').getAll(),
        tx.objectStore('categories').getAll(),
        tx.objectStore('budgets').getAll(),
      ])
      await tx.done
      return {
        transactions,
        categories,
        budgets: budgetRows.map(stripBudgetRevision),
      }
    },
  }
}

export const domainRepository = createDomainRepository()

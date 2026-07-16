import type { Category, Transaction } from '../types'
import type { CloudRecord, OperationResult, SyncTransport } from '../sync/contracts'
import { createDomainRepository } from '../sync/domain-repository'
import { getWorkspaceSnapshot, switchWorkspace } from '../sync/local-db'
import { createSyncEngine } from '../sync/sync-engine'

type ServerRow = CloudRecord & { operationIds: Set<string> }

interface SyncOptions {
  delayPull?: boolean
}

interface SimpleDevice {
  offlineAddTransaction(id: string): Promise<void>
  addTransaction(id: string): Promise<void>
  updateTransaction(id: string, note: string): Promise<void>
  deleteTransaction(id: string): Promise<void>
  upsertCategory(id: string, name: string): Promise<void>
  sync(options?: SyncOptions): Promise<void>
  switchUser(userId: string): Promise<void>
  transactionIds(): Promise<string[]>
  categoryName(id: string): Promise<string | undefined>
}

let harnessNumber = 0
const timestamp = '2026-07-16T00:00:00.000Z'

export function createSimpleSyncHarness(): {
  device(name: string, userId?: string): Promise<SimpleDevice>
  loseNextResponse(): void
  resolveDelayedPull(): void
  waitForDelayedPull(): Promise<void>
  serverWriteCount(entityId: string): number
} {
  const namespace = `simple-sync-${harnessNumber++}`
  const rows = new Map<string, ServerRow>()
  const writeCounts = new Map<string, number>()
  let loseResponse = false
  let delayedPull: (() => void) | null = null
  let delayedPullStarted: (() => void) | null = null

  const key = (userId: string, entityType: CloudRecord['entityType'], entityId: string) => `${userId}:${entityType}:${entityId}`
  const clone = (row: CloudRecord): CloudRecord => ({ ...row, record: row.record ? structuredClone(row.record) : null })

  const makeTransport = (userId: string, options: SyncOptions = {}): SyncTransport => ({
    async pullAll() {
      if (options.delayPull) {
        await new Promise<void>(resolve => {
          delayedPull = resolve
          delayedPullStarted?.()
          delayedPullStarted = null
        })
      }
      return [...rows.entries()]
        .filter(([rowKey]) => rowKey.startsWith(`${userId}:`))
        .map(([, row]) => clone(row))
    },
    async push(operation) {
      const rowKey = key(userId, operation.entityType, operation.entityId)
      const existing = rows.get(rowKey)
      let result: OperationResult
      if (existing?.operationIds.has(operation.operationId)) {
        result = { ...clone(existing), operationId: operation.operationId, status: 'duplicate' }
      } else if (operation.operation === 'upsert' && existing?.deletedAt) {
        existing.operationIds.add(operation.operationId)
        result = { ...clone(existing), operationId: operation.operationId, status: 'rejected_deleted' }
      } else {
        const record: CloudRecord = {
          entityType: operation.entityType,
          entityId: operation.entityId,
          record: operation.operation === 'delete' ? null : structuredClone(operation.payload),
          updatedAt: timestamp,
          deletedAt: operation.operation === 'delete' ? timestamp : null,
        }
        rows.set(rowKey, { ...record, operationIds: new Set([operation.operationId]) })
        writeCounts.set(operation.entityId, (writeCounts.get(operation.entityId) ?? 0) + 1)
        result = { ...record, operationId: operation.operationId, status: operation.operation === 'delete' ? 'deleted' : 'applied' }
      }
      if (loseResponse) {
        loseResponse = false
        throw new Error('response lost after server acceptance')
      }
      return result
    },
    async subscribe() {
      return async () => undefined
    },
  })

  const device = async (name: string, initialUser = 'user-one'): Promise<SimpleDevice> => {
    let userId = initialUser
    const workspaceUser = () => `${namespace}-${name}-${userId}`
    const activate = () => switchWorkspace({ kind: 'user', userId: workspaceUser() })
    await activate()
    const repository = createDomainRepository({ operationId: (() => {
      let count = 0
      return () => `${name}-${++count}`
    })() })
    const transaction = (id: string, note = ''): Transaction => ({
      id, amount: 10, type: 'expense', categoryId: 'food', note, date: '2026-07-16', source: 'manual', createdAt: timestamp, updatedAt: timestamp,
    })
    const category = (id: string, name: string): Category => ({
      id, name, type: 'expense', isSystem: false, sortOrder: 1, createdAt: timestamp,
    })
    const snapshot = async () => repository.exportSnapshot()

    return {
      async offlineAddTransaction(id) { await activate(); await repository.upsert('transaction', transaction(id)) },
      async addTransaction(id) { await activate(); await repository.upsert('transaction', transaction(id)) },
      async updateTransaction(id, note) { await activate(); await repository.upsert('transaction', transaction(id, note)) },
      async deleteTransaction(id) { await activate(); await repository.remove('transaction', id) },
      async upsertCategory(id, name) { await activate(); await repository.upsert('category', category(id, name)) },
      async sync(options = {}) {
        await activate()
        const engine = createSyncEngine({ userId, workspace: await getWorkspaceSnapshot(), repository, transport: makeTransport(userId, options) })
        await engine.start()
        await engine.stop()
      },
      async switchUser(nextUserId) { userId = nextUserId; await activate() },
      async transactionIds() { await activate(); return (await snapshot()).transactions.map(row => row.id).sort() },
      async categoryName(id) { await activate(); return (await snapshot()).categories.find(row => row.id === id)?.name },
    }
  }

  return {
    device,
    loseNextResponse() { loseResponse = true },
    resolveDelayedPull() { delayedPull?.(); delayedPull = null },
    waitForDelayedPull() { return new Promise(resolve => { delayedPullStarted = resolve }) },
    serverWriteCount(entityId) { return writeCounts.get(entityId) ?? 0 },
  }
}

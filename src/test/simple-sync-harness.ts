import { vi } from 'vitest'
import type { Category, Transaction } from '../types'
import type { CloudRecord, OperationResult, SyncTransport } from '../sync/contracts'

type ServerRow = CloudRecord & { operationIds: Set<string> }

interface SyncOptions {
  delayPull?: boolean
}

interface SimpleDevice {
  goOffline(): Promise<void>
  goOnline(): Promise<void>
  addTransaction(id: string): Promise<void>
  updateTransaction(id: string, note: string): Promise<void>
  deleteTransaction(id: string): Promise<void>
  upsertCategory(id: string, name: string): Promise<void>
  sync(options?: SyncOptions): Promise<void>
  switchUser(userId: string): Promise<void>
  transactionIds(): Promise<string[]>
  categoryName(id: string): Promise<string | undefined>
  pendingOperationCount(): Promise<number>
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

  const device = async (name: string, initialUser = 'user-one'): Promise<SimpleDevice> => {
    // Each device gets its own actual local-db/domain-repository/sync-engine module graph.
    // Resetting before dynamic imports prevents the local-db active-workspace singleton
    // from being shared by the two simulated devices.
    vi.resetModules()
    const localDb = await import('../sync/local-db')
    const { createDomainRepository } = await import('../sync/domain-repository')
    const { createSyncEngine } = await import('../sync/sync-engine')

    let userId = initialUser
    let online = true
    let delayNextPull = false
    let onConnection: ((online: boolean) => void) | null = null
    const workspaceUser = () => `${namespace}-${name}-${userId}`
    await localDb.switchWorkspace({ kind: 'user', userId: workspaceUser() })

    const makeTransport = (): SyncTransport => ({
      async pullAll() {
        if (!online) throw new Error('transport unavailable while offline')
        if (delayNextPull) {
          delayNextPull = false
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
        if (!online) throw new Error('transport unavailable while offline')
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
          result = {
            ...record,
            operationId: operation.operationId,
            status: operation.operation === 'delete' ? 'deleted' : 'applied',
          }
        }
        if (loseResponse) {
          loseResponse = false
          throw new Error('response lost after server acceptance')
        }
        return result
      },
      async subscribe(_onWake, connection) {
        onConnection = connection
        return async () => undefined
      },
    })
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
    let engine = createSyncEngine({
      userId,
      workspace: await localDb.getWorkspaceSnapshot(),
      repository,
      transport: makeTransport(),
    })
    let engineUserId = userId
    await engine.start()

    const ensureCurrentEngine = async () => {
      if (engineUserId === userId) return
      await engine.stop()
      engine = createSyncEngine({
        userId,
        workspace: await localDb.getWorkspaceSnapshot(),
        repository,
        transport: makeTransport(),
      })
      engineUserId = userId
      await engine.start()
    }

    return {
      async goOffline() { online = false; onConnection?.(false) },
      async goOnline() { online = true; onConnection?.(true) },
      async addTransaction(id) { await repository.upsert('transaction', transaction(id)) },
      async updateTransaction(id, note) { await repository.upsert('transaction', transaction(id, note)) },
      async deleteTransaction(id) { await repository.remove('transaction', id) },
      async upsertCategory(id, name) { await repository.upsert('category', category(id, name)) },
      async sync(options = {}) {
        await ensureCurrentEngine()
        delayNextPull = options.delayPull ?? false
        engine.wake('manual')
        await engine.start()
      },
      async switchUser(nextUserId) { userId = nextUserId; await localDb.switchWorkspace({ kind: 'user', userId: workspaceUser() }) },
      async transactionIds() { return (await snapshot()).transactions.map(row => row.id).sort() },
      async categoryName(id) { return (await snapshot()).categories.find(row => row.id === id)?.name },
      async pendingOperationCount() { return localDb.outboxOps.countPending() },
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

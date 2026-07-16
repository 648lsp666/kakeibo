import { describe, expect, it, vi } from 'vitest'
import type { PendingOperation } from './contracts'
import {
  getActiveWorkspace,
  getWorkspaceSnapshot,
  importAnonymousWebDavTransactions,
  isWorkspaceCurrent,
  openWorkspace,
  outboxOps,
  setWorkspaceOpenerForTests,
  syncMetaOps,
  switchWorkspace,
  withWorkspaceWrite,
  workspaceDbName,
} from './local-db'
import type { BudgetRule, Transaction } from '../types'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

const transaction = (id: string, note = 'local'): Transaction => ({
  id,
  amount: 29,
  type: 'expense',
  categoryId: 'cat-food',
  note,
  date: '2026-07-15',
  source: 'manual',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
})

const operation = (payload: Transaction, operationId = `operation-${payload.id}`): PendingOperation => ({
  operationId,
  entityType: 'transaction',
  entityId: payload.id,
  operation: 'upsert',
  payload,
  createdAt: '2026-07-15T00:00:00.000Z',
  attemptCount: 0,
  nextAttemptAt: '2026-07-15T00:00:00.000Z',
  state: 'pending',
})

async function createVersionOneDatabase(
  name: string,
  tx: Transaction,
  budgets?: BudgetRule[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
      transactions.createIndex('by-date', 'date')
      transactions.createIndex('by-external', 'externalId')
      const categories = db.createObjectStore('categories', { keyPath: 'id' })
      categories.createIndex('by-sort', 'sortOrder')
      db.createObjectStore('sync_config', { keyPath: 'key' })

      request.transaction!.objectStore('transactions').put(tx)
      if (budgets) {
        request.transaction!.objectStore('sync_config').put({
          key: 'budgets',
          value: JSON.stringify(budgets),
        })
      }
    }
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
  })
}

async function createVersionTwoDatabase(name: string, tx: Transaction): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 2)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      const transactions = db.createObjectStore('transactions', { keyPath: 'id' })
      transactions.createIndex('by-date', 'date')
      transactions.createIndex('by-external', 'externalId')
      const categories = db.createObjectStore('categories', { keyPath: 'id' })
      categories.createIndex('by-sort', 'sortOrder')
      db.createObjectStore('budgets', { keyPath: 'id' })
      db.createObjectStore('sync_config', { keyPath: 'key' })
      db.createObjectStore('outbox', { keyPath: 'mutationId' })
      db.createObjectStore('sync_meta', { keyPath: 'key' })

      request.transaction!.objectStore('transactions').put(tx)
      request.transaction!.objectStore('sync_config').put({ key: 'webdav_url', value: 'https://dav.example.com' })
      request.transaction!.objectStore('sync_meta').put({ key: 'last_synced_at', value: '2026-07-15T00:00:00.000Z' })
      request.transaction!.objectStore('outbox').put({
        mutationId: `legacy-${tx.id}`,
        entityType: 'transaction',
        entityId: tx.id,
        operation: 'upsert',
        payload: tx,
        createdAt: '2026-07-15T00:00:00.000Z',
        state: 'pending',
      })
    }
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
  })
}

describe('workspace database', () => {
  it('imports a WebDAV recovery into the anonymous ledger without changing its outbox', async () => {
    await switchWorkspace({ kind: 'anonymous' })
    const existing = transaction('existing')
    const restored = { ...transaction('restored'), updatedAt: '2026-07-16T00:00:00.000Z' }
    await withWorkspaceWrite(['transactions', 'outbox'], async tx => {
      await tx.objectStore('transactions').put(existing)
      await tx.objectStore('outbox').add({ ...operation(existing), enqueueOrder: 1 })
    })

    await expect(importAnonymousWebDavTransactions([restored])).resolves.toEqual({ added: 1, updated: 0 })

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', restored.id)).toEqual(restored)
    expect(await outboxOps.list()).toEqual([operation(existing)])
  })

  it('maps anonymous and distinct users to distinct database names', async () => {
    const anonymous = await openWorkspace({ kind: 'anonymous' })
    const userA = await openWorkspace({ kind: 'user', userId: 'local-db-name-a' })
    const userB = await openWorkspace({ kind: 'user', userId: 'local-db-name-b' })

    expect([anonymous.name, userA.name, userB.name]).toEqual([
      workspaceDbName({ kind: 'anonymous' }),
      workspaceDbName({ kind: 'user', userId: 'local-db-name-a' }),
      workspaceDbName({ kind: 'user', userId: 'local-db-name-b' }),
    ])
    expect(new Set([anonymous.name, userA.name, userB.name]).size).toBe(3)

    anonymous.close()
    userA.close()
    userB.close()
  })

  it('keeps version-1 data when opening the version-3 workspace', async () => {
    const id = { kind: 'user', userId: 'local-db-v1-data' } as const
    const legacy = transaction('legacy-transaction')
    await createVersionOneDatabase(workspaceDbName(id), legacy)

    const db = await openWorkspace(id)

    expect(await db.get('transactions', legacy.id)).toMatchObject(legacy)
    expect(db.version).toBe(3)
    db.close()
  })

  it('migrates legacy sync_config budgets into first-class rows', async () => {
    const id = { kind: 'user', userId: 'local-db-v1-budget' } as const
    const legacyBudget: BudgetRule = { id: 'budget-monthly', amount: 2000, period: 'monthly' }
    await createVersionOneDatabase(workspaceDbName(id), transaction('legacy-budget-tx'), [legacyBudget])

    const db = await openWorkspace(id)

    expect(await db.get('budgets', legacyBudget.id)).toEqual({ ...legacyBudget, revision: 0 })
    expect(await db.get('sync_config', 'budgets')).toBeUndefined()
    db.close()
  })

  it('rejects a failed legacy budget migration without an unhandled rejection', async () => {
    const id = { kind: 'user', userId: 'local-db-v1-budget-failure' } as const
    const invalidBudget = { amount: 2000, period: 'monthly' } as BudgetRule
    await createVersionOneDatabase(
      workspaceDbName(id),
      transaction('legacy-budget-failure-tx'),
      [invalidBudget],
    )

    await expect(openWorkspace(id)).rejects.toBeDefined()

    const legacy = await new Promise<{ key: string; value: string } | undefined>((resolve, reject) => {
      const request = indexedDB.open(workspaceDbName(id), 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const get = db.transaction('sync_config').objectStore('sync_config').get('budgets')
        get.onerror = () => reject(get.error)
        get.onsuccess = () => {
          db.close()
          resolve(get.result)
        }
      }
    })
    expect(legacy?.key).toBe('budgets')
  })

  it('upgrades v2 to v3 without losing business, config, or sync metadata', async () => {
    const id = { kind: 'user', userId: 'local-db-v2-data' } as const
    const legacy = transaction('v2-transaction')
    await createVersionTwoDatabase(workspaceDbName(id), legacy)

    const db = await openWorkspace(id)

    expect(db.version).toBe(3)
    expect(await db.get('transactions', legacy.id)).toEqual(legacy)
    expect(await db.get('sync_config', 'webdav_url')).toEqual({
      key: 'webdav_url',
      value: 'https://dav.example.com',
    })
    expect(await db.get('sync_meta', 'last_synced_at')).toEqual({
      key: 'last_synced_at',
      value: '2026-07-15T00:00:00.000Z',
    })
    expect(await db.getAll('outbox')).toEqual([])
    const outboxStore = db.transaction('outbox').store
    expect(outboxStore.keyPath).toBe('operationId')
    expect(Array.from(outboxStore.indexNames)).toEqual([
      'by-entity',
      'by-order',
      'by-state',
    ])
    db.close()
  })

  it('atomically writes across workspace stores', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-atomic-success' })
    const local = transaction('atomic-success')

    await withWorkspaceWrite(['transactions', 'sync_meta'], async tx => {
      await tx.objectStore('transactions').put(local)
      await tx.objectStore('sync_meta').put({ key: 'atomic', value: 'committed' })
    })

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', local.id)).toEqual(local)
    expect(await syncMetaOps.get('atomic')).toBe('committed')
  })

  it('rolls back every store when an atomic callback throws', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-atomic-failure' })
    const local = transaction('atomic-failure')

    await expect(withWorkspaceWrite(['transactions', 'sync_meta'], async tx => {
      await tx.objectStore('transactions').put(local)
      await tx.objectStore('sync_meta').put({ key: 'atomic', value: 'rolled-back' })
      throw new Error('stop atomic write')
    })).rejects.toThrow('stop atomic write')

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', local.id)).toBeUndefined()
    expect(await syncMetaOps.get('atomic')).toBeUndefined()
  })

  it('rejects duplicate operation IDs and keeps pending operations in enqueue order', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-outbox-order' })
    const first = operation(transaction('first'), 'same-operation')
    const second = {
      ...operation(transaction('second'), 'second-operation'),
      createdAt: '2026-07-14T00:00:00.000Z',
    }

    await outboxOps.add(first)
    await expect(outboxOps.add({ ...first, payload: transaction('replacement') })).rejects.toThrow()
    await outboxOps.add(second)

    expect(await outboxOps.pending()).toEqual([first, second])
    expect(await syncMetaOps.get('outbox_sequence')).toBe('2')
    const db = await getActiveWorkspace()
    expect((await db.get('outbox', first.operationId))?.enqueueOrder).toBe(1)
    expect((await db.get('outbox', second.operationId))?.enqueueOrder).toBe(2)
  })

  it('never lets one outbox put cross into a newly active account', async () => {
    const oldId = { kind: 'user', userId: 'local-db-put-old' } as const
    const newId = { kind: 'user', userId: 'local-db-put-new' } as const
    await switchWorkspace(oldId)
    const oldDb = await getActiveWorkspace()
    const originalTransaction = oldDb.transaction.bind(oldDb)
    const readStarted = deferred<void>()
    const releaseRead = deferred<void>()

    vi.spyOn(oldDb, 'transaction').mockImplementation(((...args: Parameters<typeof originalTransaction>) => {
      const tx = originalTransaction(...args)
      if (Array.from(tx.objectStoreNames).includes('outbox')) {
        const store = tx.objectStore('outbox')
        const originalGet = store.get.bind(store)
        vi.spyOn(store, 'get').mockImplementation(async key => {
          const result = await originalGet(key)
          readStarted.resolve()
          await releaseRead.promise
          return result
        })
      }
      return tx
    }) as typeof oldDb.transaction)

    const pending = operation(transaction('workspace-bound-put'))
    const write = outboxOps.put(pending).then(
      () => ({ kind: 'resolved' as const }),
      error => ({ kind: 'rejected' as const, error }),
    )

    await readStarted.promise
    await switchWorkspace(newId)
    releaseRead.resolve()
    const result = await write

    const newDb = await getActiveWorkspace()
    expect(await newDb.get('outbox', pending.operationId)).toBeUndefined()

    if (result.kind === 'resolved') {
      await switchWorkspace(oldId)
      expect(await outboxOps.get(pending.operationId)).toEqual(pending)
    } else {
      expect(result.error).toBeDefined()
    }
  })

  it('exposes a generation snapshot that becomes stale after switching accounts', async () => {
    const firstId = { kind: 'user', userId: 'local-db-snapshot-first' } as const
    await switchWorkspace(firstId)
    const snapshot = await getWorkspaceSnapshot()

    expect(snapshot.id).toEqual(firstId)
    expect(isWorkspaceCurrent(snapshot)).toBe(true)

    await switchWorkspace({ kind: 'user', userId: 'local-db-snapshot-last' })

    expect(isWorkspaceCurrent(snapshot)).toBe(false)
  })

  it('closes the previous active handle when switching workspaces', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-switch-a' })
    const previous = await getActiveWorkspace()

    await switchWorkspace({ kind: 'user', userId: 'local-db-switch-b' })

    await expect(async () => previous.getAll('transactions')).rejects.toThrow()
    expect((await getActiveWorkspace()).name).toBe('kakeibo-user-local-db-switch-b')
  })

  it('does not let a delayed lazy anonymous open override a login switch', async () => {
    const anonymousId = { kind: 'anonymous' } as const
    const userId = { kind: 'user', userId: 'local-db-race-login' } as const
    const anonymousDb = await openWorkspace(anonymousId)
    const userDb = await openWorkspace(userId)
    const anonymousOpen = deferred<typeof anonymousDb>()
    const userOpen = deferred<typeof userDb>()
    const restore = setWorkspaceOpenerForTests(id =>
      id.kind === 'anonymous' ? anonymousOpen.promise : userOpen.promise,
    )

    try {
      const lazyAnonymous = getActiveWorkspace()
      await Promise.resolve()
      const loginSwitch = switchWorkspace(userId)
      await Promise.resolve()

      userOpen.resolve(userDb)
      await loginSwitch
      anonymousOpen.resolve(anonymousDb)

      expect((await lazyAnonymous).name).toBe(workspaceDbName(userId))
      expect((await getActiveWorkspace()).name).toBe(workspaceDbName(userId))
      await expect(async () => anonymousDb.getAll('transactions')).rejects.toThrow()
    } finally {
      restore()
    }
  })

  it('makes the last concurrent switch win and closes the stale handle', async () => {
    const firstId = { kind: 'user', userId: 'local-db-race-first' } as const
    const lastId = { kind: 'user', userId: 'local-db-race-last' } as const
    const firstDb = await openWorkspace(firstId)
    const lastDb = await openWorkspace(lastId)
    const firstOpen = deferred<typeof firstDb>()
    const lastOpen = deferred<typeof lastDb>()
    const restore = setWorkspaceOpenerForTests(id =>
      id.kind === 'user' && id.userId === firstId.userId
        ? firstOpen.promise
        : lastOpen.promise,
    )

    try {
      const firstSwitch = switchWorkspace(firstId)
      const lastSwitch = switchWorkspace(lastId)

      lastOpen.resolve(lastDb)
      await lastSwitch
      firstOpen.resolve(firstDb)
      await firstSwitch

      expect((await getActiveWorkspace()).name).toBe(workspaceDbName(lastId))
      await expect(async () => firstDb.getAll('transactions')).rejects.toThrow()
    } finally {
      restore()
    }
  })
})

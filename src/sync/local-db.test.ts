import { describe, expect, it } from 'vitest'
import type { OutboxMutation, RemoteChange } from './contracts'
import {
  applyRemoteChanges,
  getActiveWorkspace,
  openWorkspace,
  outboxOps,
  switchWorkspace,
  withWorkspaceWrite,
  workspaceDbName,
} from './local-db'
import type { BudgetRule, Transaction } from '../types'

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

const mutation = (payload: Transaction): OutboxMutation => ({
  mutationId: `mutation-${payload.id}`,
  userId: 'user-local-db',
  deviceId: 'device-local-db',
  entityType: 'transaction',
  entityId: payload.id,
  operation: 'upsert',
  baseRevision: 0,
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

describe('workspace database', () => {
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

  it('keeps version-1 data when opening the version-2 workspace', async () => {
    const id = { kind: 'user', userId: 'local-db-v1-data' } as const
    const legacy = transaction('legacy-transaction')
    await createVersionOneDatabase(workspaceDbName(id), legacy)

    const db = await openWorkspace(id)

    expect(await db.get('transactions', legacy.id)).toMatchObject(legacy)
    expect(db.version).toBe(2)
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

  it('atomically writes a transaction and its outbox mutation', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-atomic-success' })
    const local = transaction('atomic-success')
    const pending = mutation(local)

    await withWorkspaceWrite(['transactions', 'outbox'], async tx => {
      await tx.objectStore('transactions').put(local)
      await tx.objectStore('outbox').put(pending)
    })

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', local.id)).toEqual(local)
    expect(await outboxOps.pending()).toEqual([pending])
  })

  it('rolls back every store when an atomic callback throws', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-atomic-failure' })
    const local = transaction('atomic-failure')
    const pending = mutation(local)

    await expect(withWorkspaceWrite(['transactions', 'outbox'], async tx => {
      await tx.objectStore('transactions').put(local)
      await tx.objectStore('outbox').put(pending)
      throw new Error('stop atomic write')
    })).rejects.toThrow('stop atomic write')

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', local.id)).toBeUndefined()
    expect(await outboxOps.pending()).toEqual([])
  })

  it('keeps a pending local payload visible over an applied remote baseline', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-overlay' })
    const local = transaction('overlay', 'pending local note')
    const remote = transaction('overlay', 'remote note')
    await withWorkspaceWrite(['transactions', 'outbox'], async tx => {
      await tx.objectStore('transactions').put(local)
      await tx.objectStore('outbox').put(mutation(local))
    })
    const change: RemoteChange = {
      sequence: 1,
      entityType: 'transaction',
      entityId: remote.id,
      operation: 'upsert',
      revision: 4,
      record: remote,
      deletedAt: null,
    }

    await applyRemoteChanges([change])

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', local.id)).toMatchObject(local)
    expect(await outboxOps.pending()).toHaveLength(1)
  })

  it('does not overlay a dead-letter payload over an applied remote baseline', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-dead-letter' })
    const local = transaction('dead-letter', 'failed local note')
    const remote = transaction('dead-letter', 'remote note')
    await withWorkspaceWrite(['transactions', 'outbox'], async tx => {
      await tx.objectStore('transactions').put(local)
      await tx.objectStore('outbox').put({ ...mutation(local), state: 'dead-letter' })
    })

    await applyRemoteChanges([{
      sequence: 2,
      entityType: 'transaction',
      entityId: remote.id,
      operation: 'upsert',
      revision: 5,
      record: remote,
      deletedAt: null,
    }])

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', remote.id)).toMatchObject(remote)
  })

  it('closes the previous active handle when switching workspaces', async () => {
    await switchWorkspace({ kind: 'user', userId: 'local-db-switch-a' })
    const previous = await getActiveWorkspace()

    await switchWorkspace({ kind: 'user', userId: 'local-db-switch-b' })

    await expect(async () => previous.getAll('transactions')).rejects.toThrow()
    expect((await getActiveWorkspace()).name).toBe('kakeibo-user-local-db-switch-b')
  })
})

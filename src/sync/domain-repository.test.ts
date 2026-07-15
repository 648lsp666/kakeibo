import { beforeEach, describe, expect, it } from 'vitest'
import type { BudgetRule, Category, Transaction } from '../types'
import type { CloudRecord, PendingOperation } from './contracts'
import { createDomainRepository, domainRepository } from './domain-repository'
import { getActiveWorkspace, outboxOps, switchWorkspace } from './local-db'
import { subscribeSyncWake } from './wake-bus'

let workspace = 0

const transaction = (id: string, note = 'local', externalId?: string): Transaction => ({
  id,
  amount: 29,
  type: 'expense',
  categoryId: 'cat-food',
  note,
  date: '2026-07-15',
  source: 'manual',
  externalId,
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
})

const category = (id: string, isSystem = false): Category => ({
  id,
  name: isSystem ? '餐饮' : '咖啡',
  icon: isSystem ? 'food' : 'coffee',
  type: 'expense',
  isSystem,
  sortOrder: 1,
  createdAt: '2026-07-15T00:00:00.000Z',
})

const budget = (id: string): BudgetRule => ({ id, amount: 2000, period: 'monthly' })

const pending = (
  operationId: string,
  payload: Transaction,
  state: PendingOperation['state'] = 'pending',
): PendingOperation => ({
  operationId,
  entityType: 'transaction',
  entityId: payload.id,
  operation: 'upsert',
  payload,
  createdAt: '2026-07-15T00:00:00.000Z',
  attemptCount: 0,
  nextAttemptAt: '2026-07-15T00:00:00.000Z',
  state,
})

const cloud = (record: Transaction | null): CloudRecord => ({
  entityType: 'transaction',
  entityId: record?.id ?? 'deleted-cloud',
  record,
  updatedAt: '2026-07-15T01:00:00.000Z',
  deletedAt: record ? null : '2026-07-15T01:00:00.000Z',
})

beforeEach(async () => {
  await switchWorkspace({ kind: 'user', userId: `domain-repository-${workspace++}` })
})

describe('domain repository local writes', () => {
  it('atomically stores an upsert and its pending operation, then wakes sync', async () => {
    const local = transaction('atomic-upsert')
    const wakes: string[] = []
    const unsubscribe = subscribeSyncWake(reason => wakes.push(reason))

    await domainRepository.upsert('transaction', local)

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', local.id)).toEqual(local)
    expect(await outboxOps.pending()).toEqual([
      expect.objectContaining({
        entityType: 'transaction',
        entityId: local.id,
        operation: 'upsert',
        payload: local,
        attemptCount: 0,
        state: 'pending',
      }),
    ])
    expect(wakes).toEqual(['local-write'])
    unsubscribe()
  })

  it('rolls back the business row when adding the outbox operation fails', async () => {
    const first = transaction('first')
    const broken = transaction('broken')
    const repository = createDomainRepository({ operationId: () => 'duplicate-operation' })
    await repository.upsert('transaction', first)
    const db = await getActiveWorkspace()
    await db.clear('transactions')
    await db.clear('outbox')
    await db.put('outbox', {
      ...pending('duplicate-operation', first),
      state: 'isolated',
      enqueueOrder: 1,
    })

    await expect(repository.upsert('transaction', broken)).rejects.toThrow()

    expect(await db.get('transactions', broken.id)).toBeUndefined()
    expect(await outboxOps.pending()).toHaveLength(0)
  })

  it('removes a local record and enqueues a delete operation', async () => {
    const local = transaction('remove-me')
    const db = await getActiveWorkspace()
    await db.put('transactions', local)

    await domainRepository.remove('transaction', local.id)

    expect(await db.get('transactions', local.id)).toBeUndefined()
    expect(await outboxOps.pending()).toEqual([
      expect.objectContaining({
        entityType: 'transaction',
        entityId: local.id,
        operation: 'delete',
        payload: null,
      }),
    ])
  })

  it('keeps system categories local-only', async () => {
    const system = category('sys-food', true)

    await domainRepository.upsert('category', system)

    const db = await getActiveWorkspace()
    expect(await db.get('categories', system.id)).toEqual(system)
    expect(await outboxOps.list()).toEqual([])
  })

  it('does not enqueue deletion of an existing system category', async () => {
    const system = category('sys-food', true)
    const db = await getActiveWorkspace()
    await db.put('categories', system)

    await domainRepository.remove('category', system.id)

    expect(await db.get('categories', system.id)).toBeUndefined()
    expect(await outboxOps.list()).toEqual([])
  })

  it('imports deduplicated transactions and outbox operations atomically', async () => {
    const repository = createDomainRepository({ operationId: () => 'duplicate-import-operation' })
    const existing = transaction('existing', 'existing', 'external-existing')
    const first = transaction('import-first', 'first', 'external-first')
    const second = transaction('import-second', 'second', 'external-second')
    const db = await getActiveWorkspace()
    await db.put('transactions', existing)
    await expect(repository.importTransactions([
      transaction('skip-existing', 'skip', 'external-existing'),
      first,
      second,
    ])).rejects.toThrow()

    expect(await db.get('transactions', first.id)).toBeUndefined()
    expect(await db.get('transactions', second.id)).toBeUndefined()
    expect(await db.get('transactions', existing.id)).toEqual(existing)
    expect(await outboxOps.list()).toEqual([])
  })
})

describe('domain repository cloud application', () => {
  it('applies cloud rows and tombstones without creating outbox work or wakes', async () => {
    const removed = transaction('deleted-cloud')
    const received = transaction('received-cloud', 'cloud')
    const db = await getActiveWorkspace()
    await db.put('transactions', removed)
    const wakes: string[] = []
    const unsubscribe = subscribeSyncWake(reason => wakes.push(reason))

    await domainRepository.applyCloudRecords([cloud(null), cloud(received)])

    expect(await db.get('transactions', removed.id)).toBeUndefined()
    expect(await db.get('transactions', received.id)).toEqual(received)
    expect(await outboxOps.list()).toEqual([])
    expect(wakes).toEqual([])
    unsubscribe()
  })

  it('overlays pending local payloads on cloud data', async () => {
    const local = transaction('overlay', 'local pending')
    const remote = transaction('overlay', 'cloud baseline')
    await outboxOps.add(pending('pending-overlay', local))

    await domainRepository.applyCloudRecords([cloud(remote)])

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', local.id)).toEqual(local)
    expect(await outboxOps.pending()).toEqual([pending('pending-overlay', local)])
  })

  it('does not overlay isolated operations on cloud data', async () => {
    const isolated = transaction('isolated', 'isolated payload')
    const remote = transaction('isolated', 'cloud wins')
    await outboxOps.add(pending('isolated-operation', isolated, 'isolated'))

    await domainRepository.applyCloudRecords([cloud(remote)])

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', remote.id)).toEqual(remote)
  })

  it('exports only domain data and strips local budget metadata', async () => {
    const tx = transaction('snapshot-transaction')
    const cat = category('snapshot-category')
    const rule = budget('snapshot-budget')
    const db = await getActiveWorkspace()
    await db.put('transactions', tx)
    await db.put('categories', cat)
    await db.put('budgets', { ...rule, revision: 7 })

    await expect(domainRepository.exportSnapshot()).resolves.toEqual({
      transactions: [tx],
      categories: [cat],
      budgets: [rule],
    })
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import type { BudgetRule, Category, Transaction } from '../types'
import type { CloudRecord, OperationResult, PendingOperation } from './contracts'
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

  it('removes all account transactions and enqueues their deletes atomically', async () => {
    const first = transaction('remove-all-first')
    const second = transaction('remove-all-second')
    const db = await getActiveWorkspace()
    await db.put('transactions', first)
    await db.put('transactions', second)

    await domainRepository.removeAllTransactions()

    expect(await db.getAll('transactions')).toEqual([])
    expect(await outboxOps.pending()).toEqual([
      expect.objectContaining({ entityId: first.id, operation: 'delete' }),
      expect.objectContaining({ entityId: second.id, operation: 'delete' }),
    ])
    expect((await db.get('outbox', (await outboxOps.pending())[0].operationId))?.enqueueOrder).toBe(1)
    expect((await db.get('outbox', (await outboxOps.pending())[1].operationId))?.enqueueOrder).toBe(2)
  })

  it('never clears or enqueues into a newly selected account during remove-all', async () => {
    const accountA = { kind: 'user', userId: `remove-all-a-${workspace++}` } as const
    const accountB = { kind: 'user', userId: `remove-all-b-${workspace++}` } as const
    await switchWorkspace(accountA)
    const dbA = await getActiveWorkspace()
    const first = transaction('account-a-first')
    const second = transaction('account-a-second')
    await dbA.put('transactions', first)
    await dbA.put('transactions', second)

    let switchPromise: Promise<void> | undefined
    let operation = 0
    const repository = createDomainRepository({
      operationId: () => {
        if (operation++ === 0) switchPromise = switchWorkspace(accountB)
        return `remove-all-operation-${operation}`
      },
    })

    const clearResult = repository.removeAllTransactions().then(
      () => ({ kind: 'completed' as const }),
      error => ({ kind: 'rolled-back' as const, error }),
    )
    const result = await clearResult
    await switchPromise

    const dbB = await getActiveWorkspace()
    expect(await dbB.getAll('transactions')).toEqual([])
    expect(await dbB.getAll('outbox')).toEqual([])

    await switchWorkspace(accountA)
    const reopenedA = await getActiveWorkspace()
    if (result.kind === 'completed') {
      expect(await reopenedA.getAll('transactions')).toEqual([])
      expect(await reopenedA.count('outbox')).toBe(2)
    } else {
      expect(result.error).toBeDefined()
      expect(await reopenedA.getAll('transactions')).toEqual([first, second])
      expect(await reopenedA.getAll('outbox')).toEqual([])
    }
  })
})

describe('domain repository cloud application', () => {
  it('acknowledges one exact operation and re-overlays later pending intent atomically', async () => {
    const confirmed = transaction('acknowledged', 'server confirmed')
    const later = transaction('acknowledged', 'later local intent')
    const other = transaction('other-entity', 'untouched')
    await outboxOps.add(pending('confirmed-operation', transaction('acknowledged', 'first local intent')))
    await outboxOps.add(pending('later-operation', later))
    await outboxOps.add(pending('other-operation', other))
    const result: OperationResult = {
      ...cloud(confirmed),
      operationId: 'confirmed-operation',
      status: 'applied',
    }

    await domainRepository.acknowledgeOperation('confirmed-operation', result)

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', confirmed.id)).toEqual(later)
    expect((await outboxOps.list()).map(item => item.operationId)).toEqual(['later-operation', 'other-operation'])
  })

  it('re-overlays the confirmed operation entity when deduplication returns a different canonical ID', async () => {
    const duplicateLocal = transaction('duplicate-local', 'first duplicate intent')
    const laterLocal = transaction('duplicate-local', 'later duplicate intent')
    const canonical = transaction('canonical-server', 'canonical server row')
    await outboxOps.add(pending('deduplicated-operation', duplicateLocal))
    await outboxOps.add(pending('later-duplicate-operation', laterLocal))
    const result: OperationResult = {
      ...cloud(canonical),
      operationId: 'deduplicated-operation',
      status: 'deduplicated',
    }

    await domainRepository.acknowledgeOperation('deduplicated-operation', result)

    const db = await getActiveWorkspace()
    expect(await db.get('transactions', canonical.id)).toEqual(canonical)
    expect(await db.get('transactions', duplicateLocal.id)).toEqual(laterLocal)
    expect((await outboxOps.list()).map(item => item.operationId)).toEqual(['later-duplicate-operation'])
  })

  it('rolls back both server application and exact outbox deletion when acknowledgement fails', async () => {
    const before = transaction('ack-rollback', 'before acknowledgement')
    const server = transaction('ack-rollback', 'server result')
    const db = await getActiveWorkspace()
    await db.put('transactions', before)
    await outboxOps.add(pending('rollback-confirmed', before))
    await db.put('outbox', {
      ...pending('rollback-later', transaction('ack-rollback', 'invalid overlay')),
      payload: {} as Transaction,
      enqueueOrder: 2,
    })
    const result: OperationResult = {
      ...cloud(server),
      operationId: 'rollback-confirmed',
      status: 'applied',
    }

    await expect(domainRepository.acknowledgeOperation('rollback-confirmed', result)).rejects.toThrow()

    expect(await db.get('transactions', before.id)).toEqual(before)
    expect((await outboxOps.list()).map(item => item.operationId)).toEqual(['rollback-confirmed', 'rollback-later'])
  })

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

  it('ignores a cloud upsert that claims to be a system category', async () => {
    const system = category('cloud-system-upsert', true)

    await domainRepository.applyCloudRecords([{
      entityType: 'category',
      entityId: system.id,
      record: system,
      updatedAt: '2026-07-15T01:00:00.000Z',
      deletedAt: null,
    }])

    const db = await getActiveWorkspace()
    expect(await db.get('categories', system.id)).toBeUndefined()
    expect(await outboxOps.list()).toEqual([])
  })

  it('ignores a cloud tombstone for a local system category', async () => {
    const system = category('cloud-system-tombstone', true)
    const db = await getActiveWorkspace()
    await db.put('categories', system)

    await domainRepository.applyCloudRecords([{
      entityType: 'category',
      entityId: system.id,
      record: null,
      updatedAt: '2026-07-15T01:00:00.000Z',
      deletedAt: '2026-07-15T01:00:00.000Z',
    }])

    expect(await db.get('categories', system.id)).toEqual(system)
    expect(await outboxOps.list()).toEqual([])
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

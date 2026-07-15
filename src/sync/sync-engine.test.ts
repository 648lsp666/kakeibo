import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DomainRepository } from './domain-repository'
import type { OperationResult, PendingOperation, SyncTransport } from './contracts'
import { getWorkspaceSnapshot, outboxOps, switchWorkspace } from './local-db'
import { createSyncEngine } from './sync-engine'
import { useSyncStore } from './sync-store'
import { emitSyncWake } from './wake-bus'
import { SyncTransportError } from './supabase-transport'

let workspaceIndex = 0
const now = new Date('2026-07-16T00:00:00.000Z')

const pending = (operationId: string, entityId = operationId): PendingOperation => ({
  operationId,
  entityType: 'transaction',
  entityId,
  operation: 'upsert',
  payload: { id: entityId, amount: 10, type: 'expense', categoryId: 'food', note: '', date: '2026-07-16', source: 'manual', createdAt: now.toISOString(), updatedAt: now.toISOString() },
  createdAt: now.toISOString(),
  attemptCount: 0,
  nextAttemptAt: now.toISOString(),
  state: 'pending',
})

const result = (operation: PendingOperation): OperationResult => ({
  operationId: operation.operationId,
  status: 'applied',
  entityType: operation.entityType,
  entityId: operation.entityId,
  record: operation.payload,
  updatedAt: now.toISOString(),
  deletedAt: null,
})

function repository(overrides: Partial<DomainRepository> = {}): DomainRepository {
  return {
    upsert: vi.fn(), remove: vi.fn(), removeAllTransactions: vi.fn(), importTransactions: vi.fn(),
    applyCloudRecords: vi.fn(), acknowledgeOperation: vi.fn(),
    exportSnapshot: vi.fn(),
    ...overrides,
  } as DomainRepository
}

function transport(overrides: Partial<SyncTransport> = {}): SyncTransport {
  return {
    pullAll: vi.fn().mockResolvedValue([]),
    push: vi.fn(async operation => result(operation)),
    subscribe: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)),
    ...overrides,
  }
}

async function settle(): Promise<void> {
  await vi.waitFor(() => expect(useSyncStore.getState().status.kind).not.toBe('syncing'))
}

beforeEach(async () => {
  vi.restoreAllMocks()
  await switchWorkspace({ kind: 'user', userId: `engine-${workspaceIndex++}` })
  useSyncStore.setState({ status: { kind: 'local-only' } })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('foreground sync engine', () => {
  it('pulls, overlays, pushes by enqueue order, acknowledges, then pulls once more', async () => {
    const first = pending('first')
    const second = pending('second')
    await outboxOps.add(first)
    await outboxOps.add(second)
    const events: string[] = []
    const repo = repository({
      applyCloudRecords: vi.fn(async () => { events.push('apply') }),
      acknowledgeOperation: vi.fn(async operationId => { events.push(`ack:${operationId}`) }),
    })
    const remote = transport({
      pullAll: vi.fn(async () => { events.push('pull'); return [] }),
      push: vi.fn(async operation => { events.push(`push:${operation.operationId}`); return result(operation) }),
    })
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repo, now: () => now, random: () => 0 })

    await engine.start()

    expect(events).toEqual(['pull', 'apply', 'push:first', 'ack:first', 'push:second', 'ack:second', 'pull', 'apply'])
    await engine.stop()
  })

  it('stays offline without touching pending operations', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await outboxOps.add(pending('offline-op'))
    const remote = transport()
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repository(), now: () => now })

    await engine.start()

    expect(remote.pullAll).not.toHaveBeenCalled()
    expect(useSyncStore.getState().status).toEqual({ kind: 'offline', pending: 1 })
    expect(await outboxOps.pending()).toHaveLength(1)
    await engine.stop()
  })

  it('reports auth-required and retains the outbox on 401', async () => {
    await outboxOps.add(pending('auth-op'))
    const remote = transport({ push: vi.fn().mockRejectedValue(new SyncTransportError('expired', 'auth', 401)) })
    const repo = repository()
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repo, now: () => now })

    await engine.start()

    expect(useSyncStore.getState().status).toEqual({ kind: 'auth-required', pending: 1 })
    expect(repo.acknowledgeOperation).not.toHaveBeenCalled()
    expect(await outboxOps.pending()).toHaveLength(1)
    await engine.stop()
  })

  it.each([[429, 'rate-limit'], [503, 'transient']] as const)('backs off a pending operation after HTTP %s', async (status, kind) => {
    await outboxOps.add(pending(`retry-${status}`))
    const remote = transport({ push: vi.fn().mockRejectedValue(new SyncTransportError('retry', kind, status)) })
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repository(), now: () => now, random: () => 1 })

    await engine.start()

    expect(await outboxOps.get(`retry-${status}`)).toMatchObject({
      attemptCount: 1,
      nextAttemptAt: '2026-07-16T00:00:02.500Z',
      state: 'pending',
    })
    await engine.stop()
  })

  it('does not overtake an earlier operation whose retry time has not arrived', async () => {
    const earlier = { ...pending('earlier'), nextAttemptAt: '2026-07-16T00:01:00.000Z' }
    const later = pending('later')
    await outboxOps.add(earlier)
    await outboxOps.add(later)
    const remote = transport()
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repository(), now: () => now })

    await engine.start()

    expect(remote.push).not.toHaveBeenCalled()
    await engine.stop()
  })

  it('wakes itself when a retry delay expires', async () => {
    await outboxOps.add(pending('timed-retry'))
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(now)
    try {
      const push = vi.fn()
        .mockRejectedValueOnce(new SyncTransportError('retry', 'transient', 503))
        .mockImplementation(async operation => result(operation))
      const engine = createSyncEngine({
        userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: transport({ push }),
        repository: repository(), now: () => new Date(Date.now()), random: () => 1,
      })

      await engine.start()
      expect(push).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(2_500)
      await vi.runAllTimersAsync()
      expect(push).toHaveBeenCalledTimes(2)
      await engine.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('isolates only a protocol-invalid operation and continues with the next one', async () => {
    await outboxOps.add(pending('invalid'))
    await outboxOps.add(pending('valid'))
    const acknowledged: string[] = []
    const repo = repository({ acknowledgeOperation: vi.fn(async operationId => { acknowledged.push(operationId) }) })
    const remote = transport({
      push: vi.fn(async operation => {
        if (operation.operationId === 'invalid') throw new SyncTransportError('bad payload', 'protocol', 400)
        return result(operation)
      }),
    })
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repo, now: () => now })

    await engine.start()

    expect(await outboxOps.get('invalid')).toMatchObject({ state: 'isolated', lastError: 'bad payload' })
    expect(acknowledged).toEqual(['valid'])
    await engine.stop()
  })

  it('wakes a quiet engine from Realtime, network, visibility, and the wake bus', async () => {
    let realtimeWake: (() => void) | undefined
    const pullAll = vi.fn().mockResolvedValue([])
    const remote = transport({
      pullAll,
      subscribe: vi.fn(async onWake => { realtimeWake = onWake; return vi.fn().mockResolvedValue(undefined) }),
    })
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repository(), now: () => now })
    await engine.start()
    expect(pullAll).toHaveBeenCalledTimes(1)

    realtimeWake?.()
    await vi.waitFor(() => expect(pullAll).toHaveBeenCalledTimes(2))
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(pullAll).toHaveBeenCalledTimes(3))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(pullAll).toHaveBeenCalledTimes(4))
    emitSyncWake('local-write')
    await vi.waitFor(() => expect(pullAll).toHaveBeenCalledTimes(5))
    await engine.stop()
  })

  it('discards a late pull after workspace generation change', async () => {
    let resolvePull: ((records: []) => void) | undefined
    const remote = transport({ pullAll: vi.fn(() => new Promise<[]>(resolve => { resolvePull = resolve })) })
    const repo = repository()
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repo, now: () => now })
    const starting = engine.start()
    await vi.waitFor(() => expect(remote.pullAll).toHaveBeenCalledOnce())
    await switchWorkspace({ kind: 'user', userId: `switched-${workspaceIndex++}` })
    resolvePull?.([])
    await starting

    expect(repo.applyCloudRecords).not.toHaveBeenCalled()
    await engine.stop()
  })

  it('discards a late pull after stop', async () => {
    let resolvePull: ((records: []) => void) | undefined
    const remote = transport({ pullAll: vi.fn(() => new Promise<[]>(resolve => { resolvePull = resolve })) })
    const repo = repository()
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repo, now: () => now })
    const starting = engine.start()
    await vi.waitFor(() => expect(remote.pullAll).toHaveBeenCalledOnce())
    const stopping = engine.stop()
    resolvePull?.([])
    await Promise.all([starting, stopping])

    expect(repo.applyCloudRecords).not.toHaveBeenCalled()
  })

  it('unsubscribes all wake sources on stop', async () => {
    let realtimeWake: (() => void) | undefined
    const pullAll = vi.fn().mockResolvedValue([])
    const unsubscribe = vi.fn().mockResolvedValue(undefined)
    const remote = transport({
      pullAll,
      subscribe: vi.fn(async onWake => { realtimeWake = onWake; return unsubscribe }),
    })
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: remote, repository: repository(), now: () => now })
    await engine.start()
    await engine.stop()

    realtimeWake?.()
    emitSyncWake('local-write')
    window.dispatchEvent(new Event('online'))
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(pullAll).toHaveBeenCalledOnce()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('coalesces duplicate wakes without concurrent loops', async () => {
    let active = 0
    let maximum = 0
    let release: (() => void) | undefined
    const pullAll = vi.fn(async () => {
      active++
      maximum = Math.max(maximum, active)
      if (pullAll.mock.calls.length === 2) await new Promise<void>(resolve => { release = resolve })
      active--
      return []
    })
    const engine = createSyncEngine({ userId: 'user-1', workspace: await getWorkspaceSnapshot(), transport: transport({ pullAll }), repository: repository(), now: () => now })
    await engine.start()

    engine.wake('manual')
    engine.wake('realtime')
    await vi.waitFor(() => expect(pullAll).toHaveBeenCalledTimes(2))
    expect(maximum).toBe(1)
    release?.()
    await settle()
    expect(maximum).toBe(1)
    await engine.stop()
  })
})

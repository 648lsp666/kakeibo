import type { DomainRepository } from './domain-repository'
import type { PendingOperation, SyncStatus, SyncTransport } from './contracts'
import type { WorkspaceSnapshot } from './local-db'
import { isWorkspaceCurrent } from './local-db'
import { subscribeSyncWake } from './wake-bus'
import { useSyncStore } from './sync-store'
import { SyncTransportError } from './supabase-transport'

export interface SyncEngine {
  start(): Promise<void>
  wake(reason: 'local-write' | 'realtime' | 'online' | 'foreground' | 'manual'): void
  stop(): Promise<void>
}

interface SyncEngineInput {
  userId: string
  workspace: WorkspaceSnapshot
  transport: SyncTransport
  repository: DomainRepository
  now?: () => Date
  random?: () => number
}

export function createSyncEngine(input: SyncEngineInput): SyncEngine {
  const now = input.now ?? (() => new Date())
  const random = input.random ?? Math.random
  let running = false
  let queued = false
  let loopPromise: Promise<void> | null = null
  let realtimeUnsubscribe: (() => Promise<void>) | null = null
  let wakeUnsubscribe: (() => void) | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let connectionOnline = typeof navigator === 'undefined' || navigator.onLine

  const isActiveWorkspace = () => running && isWorkspaceCurrent(input.workspace)
  const setStatus = (status: SyncStatus) => {
    if (isActiveWorkspace()) useSyncStore.getState().setStatus(status)
  }
  const pendingCount = () => input.workspace.db.countFromIndex('outbox', 'by-state', 'pending')

  async function pendingOperations(): Promise<Array<PendingOperation & { enqueueOrder: number }>> {
    const operations = await input.workspace.db.getAllFromIndex('outbox', 'by-order')
    return operations.filter(operation => operation.state === 'pending')
  }

  async function updateOperation(
    operationId: string,
    update: (operation: PendingOperation & { enqueueOrder: number }) => PendingOperation & { enqueueOrder: number },
  ): Promise<void> {
    const tx = input.workspace.db.transaction('outbox', 'readwrite')
    const operation = await tx.store.get(operationId)
    if (operation) await tx.store.put(update(operation))
    await tx.done
  }

  function scheduleRetry(delay: number): void {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      engine.wake('manual')
    }, delay)
  }

  async function handleRequestError(error: unknown, operation?: PendingOperation): Promise<'continue' | 'stop'> {
    if (!isActiveWorkspace()) return 'stop'
    const pending = await pendingCount()
    if (!isActiveWorkspace()) return 'stop'
    if (error instanceof SyncTransportError && error.kind === 'auth') {
      setStatus({ kind: 'auth-required', pending })
      return 'stop'
    }
    if (operation && error instanceof SyncTransportError && error.kind === 'protocol') {
      await updateOperation(operation.operationId, stored => ({
        ...stored,
        state: 'isolated',
        lastError: error.message,
      }))
      return 'continue'
    }
    if (operation && error instanceof SyncTransportError
      && (error.kind === 'rate-limit' || error.kind === 'transient')) {
      const attemptCount = operation.attemptCount + 1
      const delay = Math.min(2 ** attemptCount * 1000 + random() * 500, 300_000)
      await updateOperation(operation.operationId, stored => ({
        ...stored,
        attemptCount,
        nextAttemptAt: new Date(now().getTime() + delay).toISOString(),
        lastError: error.message,
      }))
      scheduleRetry(delay)
      const remaining = await pendingCount()
      if (!isActiveWorkspace()) return 'stop'
      setStatus(connectionOnline
        ? { kind: 'error', pending: remaining, message: error.message }
        : { kind: 'offline', pending: remaining })
      return 'stop'
    }
    const message = error instanceof Error ? error.message : 'Sync failed'
    setStatus(connectionOnline
      ? { kind: 'error', pending, message }
      : { kind: 'offline', pending })
    return 'stop'
  }

  async function pullAndApply(): Promise<boolean> {
    if (!isActiveWorkspace()) return false
    let records
    try {
      records = await input.transport.pullAll()
    } catch (error) {
      if (!isActiveWorkspace()) return false
      await handleRequestError(error)
      return false
    }
    if (!isActiveWorkspace()) return false
    await input.repository.applyCloudRecords(records)
    return isActiveWorkspace()
  }

  async function synchronize(): Promise<void> {
    if (!isActiveWorkspace()) return
    const initialPending = await pendingCount()
    if (!isActiveWorkspace()) return
    if (!connectionOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setStatus({ kind: 'offline', pending: initialPending })
      return
    }
    setStatus({ kind: 'syncing', pending: initialPending })
    if (!await pullAndApply()) return

    const operations = await pendingOperations()
    if (!isActiveWorkspace()) return
    let pushed = false
    for (const operation of operations) {
      const retryDelay = Date.parse(operation.nextAttemptAt) - now().getTime()
      if (retryDelay > 0) {
        scheduleRetry(retryDelay)
        break
      }
      if (!isActiveWorkspace()) return
      let result
      try {
        result = await input.transport.push(operation)
      } catch (error) {
        if (!isActiveWorkspace()) return
        const action = await handleRequestError(error, operation)
        if (action === 'continue') continue
        return
      }
      if (!isActiveWorkspace()) return
      await input.repository.acknowledgeOperation(operation.operationId, result)
      if (!isActiveWorkspace()) return
      pushed = true
    }

    if (pushed && !await pullAndApply()) return
    if (!isActiveWorkspace()) return
    const lastSyncedAt = now().toISOString()
    await input.workspace.db.put('sync_meta', { key: 'last_synced_at', value: lastSyncedAt })
    if (isActiveWorkspace()) setStatus({ kind: 'idle', lastSyncedAt })
  }

  function requestLoop(): void {
    if (!isActiveWorkspace()) return
    queued = true
    if (loopPromise) return
    loopPromise = (async () => {
      while (queued && isActiveWorkspace()) {
        queued = false
        await synchronize()
      }
    })().finally(() => {
      loopPromise = null
      if (queued && isActiveWorkspace()) requestLoop()
    })
  }

  const onlineListener = () => {
    connectionOnline = true
    engine.wake('online')
  }
  const visibilityListener = () => {
    if (document.visibilityState === 'visible') engine.wake('foreground')
  }

  const engine: SyncEngine = {
    async start() {
      if (running) {
        if (loopPromise) await loopPromise
        return
      }
      running = true
      connectionOnline = typeof navigator === 'undefined' || navigator.onLine
      wakeUnsubscribe = subscribeSyncWake(reason => engine.wake(reason))
      if (typeof window !== 'undefined') window.addEventListener('online', onlineListener)
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibilityListener)

      if (!isActiveWorkspace()) return
      let unsubscribe: () => Promise<void>
      try {
        unsubscribe = await input.transport.subscribe(
          () => engine.wake('realtime'),
          online => {
            connectionOnline = online
            if (online) engine.wake('online')
          },
        )
      } catch (error) {
        if (isActiveWorkspace()) await handleRequestError(error)
        return
      }
      if (!isActiveWorkspace()) {
        await unsubscribe()
        return
      }
      realtimeUnsubscribe = unsubscribe
      requestLoop()
      if (loopPromise) await loopPromise
    },

    wake(_reason) {
      requestLoop()
    },

    async stop() {
      if (!running) return
      running = false
      queued = false
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      wakeUnsubscribe?.()
      wakeUnsubscribe = null
      if (typeof window !== 'undefined') window.removeEventListener('online', onlineListener)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilityListener)
      const unsubscribe = realtimeUnsubscribe
      realtimeUnsubscribe = null
      if (unsubscribe) await unsubscribe()
      if (loopPromise) await loopPromise
    },
  }

  return engine
}

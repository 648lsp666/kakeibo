import type { DomainRepository } from './domain-repository'
import type { PendingOperation, SyncStatus, SyncTransport } from './contracts'
import type { WorkspaceSnapshot } from './local-db'
import { isWorkspaceCurrent } from './local-db'
import { subscribeSyncWake } from './wake-bus'
import { useSyncStore } from './sync-store'
import { SyncTransportError } from './supabase-transport'

export interface SyncEngine {
  start(background?: boolean): Promise<void>
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
  let queuedGeneration: number | null = null
  let loopPromise: Promise<void> | null = null
  let realtimeUnsubscribe: (() => Promise<void>) | null = null
  let wakeUnsubscribe: (() => void) | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let connectionOnline = typeof navigator === 'undefined' || navigator.onLine
  let lifecycleGeneration = 0
  let pullRetryCount = 0

  const isActiveWorkspace = () => running && isWorkspaceCurrent(input.workspace)
  const ownsLifecycle = (generation: number) => isActiveWorkspace() && lifecycleGeneration === generation
  const setStatus = (generation: number, status: SyncStatus) => {
    if (ownsLifecycle(generation)) useSyncStore.getState().setStatus(status)
  }
  const pendingCount = () => input.workspace.db.countFromIndex('outbox', 'by-state', 'pending')

  async function reconcileIsolated(generation: number): Promise<void> {
    if (!ownsLifecycle(generation)) return
    const operations = await input.workspace.db.getAllFromIndex('outbox', 'by-state', 'isolated')
    if (!ownsLifecycle(generation)) return
    useSyncStore.getState().setIsolated(operations.length, operations[0]?.lastError)
  }

  async function pendingOperations(): Promise<Array<PendingOperation & { enqueueOrder: number }>> {
    const operations = await input.workspace.db.getAllFromIndex('outbox', 'by-order')
    return operations.filter(operation => operation.state === 'pending')
  }

  async function updateOperation(
    generation: number,
    operationId: string,
    update: (operation: PendingOperation & { enqueueOrder: number }) => PendingOperation & { enqueueOrder: number },
  ): Promise<boolean> {
    if (!ownsLifecycle(generation)) return false
    const tx = input.workspace.db.transaction('outbox', 'readwrite')
    if (!ownsLifecycle(generation)) return false
    const operation = await tx.store.get(operationId)
    if (!ownsLifecycle(generation)) return false
    if (operation) {
      await tx.store.put(update(operation))
      if (!ownsLifecycle(generation)) return false
    }
    await tx.done
    return ownsLifecycle(generation)
  }

  function scheduleRetry(generation: number, delay: number): void {
    if (!ownsLifecycle(generation)) return
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      if (ownsLifecycle(generation)) engine.wake('manual')
    }, delay)
  }

  async function handleRequestError(
    generation: number,
    error: unknown,
    operation?: PendingOperation,
  ): Promise<'continue' | 'stop'> {
    if (!ownsLifecycle(generation)) return 'stop'
    const pending = await pendingCount()
    if (!ownsLifecycle(generation)) return 'stop'
    if (error instanceof SyncTransportError && error.kind === 'auth') {
      setStatus(generation, { kind: 'auth-required', pending })
      return 'stop'
    }
    if (operation && error instanceof SyncTransportError && error.kind === 'protocol') {
      await updateOperation(generation, operation.operationId, stored => ({
        ...stored,
        state: 'isolated',
        lastError: error.message,
      }))
      if (!ownsLifecycle(generation)) return 'stop'
      await reconcileIsolated(generation)
      return 'continue'
    }
    if (!operation && error instanceof SyncTransportError
      && (error.kind === 'rate-limit' || error.kind === 'transient')) {
      const delay = Math.min(2 ** ++pullRetryCount * 1000 + random() * 500, 300_000)
      scheduleRetry(generation, delay)
      setStatus(generation, connectionOnline
        ? { kind: 'error', pending, message: error.message }
        : { kind: 'offline', pending })
      return 'stop'
    }
    if (operation && error instanceof SyncTransportError
      && (error.kind === 'rate-limit' || error.kind === 'transient')) {
      const attemptCount = operation.attemptCount + 1
      const delay = Math.min(2 ** attemptCount * 1000 + random() * 500, 300_000)
      await updateOperation(generation, operation.operationId, stored => ({
        ...stored,
        attemptCount,
        nextAttemptAt: new Date(now().getTime() + delay).toISOString(),
        lastError: error.message,
      }))
      if (!ownsLifecycle(generation)) return 'stop'
      scheduleRetry(generation, delay)
      const remaining = await pendingCount()
      if (!ownsLifecycle(generation)) return 'stop'
      setStatus(generation, connectionOnline
        ? { kind: 'error', pending: remaining, message: error.message }
        : { kind: 'offline', pending: remaining })
      return 'stop'
    }
    const message = error instanceof Error ? error.message : 'Sync failed'
    setStatus(generation, connectionOnline
      ? { kind: 'error', pending, message }
      : { kind: 'offline', pending })
    return 'stop'
  }

  async function pullAndApply(generation: number): Promise<boolean> {
    if (!ownsLifecycle(generation)) return false
    let records
    try {
      if (!ownsLifecycle(generation)) return false
      records = await input.transport.pullAll()
    } catch (error) {
      if (!ownsLifecycle(generation)) return false
      await handleRequestError(generation, error)
      if (!ownsLifecycle(generation)) return false
      return false
    }
    if (!ownsLifecycle(generation)) return false
    pullRetryCount = 0
    await input.repository.applyCloudRecords(records, input.workspace)
    return ownsLifecycle(generation)
  }

  async function synchronize(generation: number): Promise<void> {
    if (!ownsLifecycle(generation)) return
    const initialPending = await pendingCount()
    if (!ownsLifecycle(generation)) return
    if (!connectionOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setStatus(generation, { kind: 'offline', pending: initialPending })
      return
    }
    setStatus(generation, { kind: 'syncing', pending: initialPending })
    if (!ownsLifecycle(generation) || !await pullAndApply(generation)) return
    if (!ownsLifecycle(generation)) return

    const operations = await pendingOperations()
    if (!ownsLifecycle(generation)) return
    let pushed = false
    for (const operation of operations) {
      const retryDelay = Date.parse(operation.nextAttemptAt) - now().getTime()
      if (retryDelay > 0) {
        scheduleRetry(generation, retryDelay)
        break
      }
      if (!ownsLifecycle(generation)) return
      let result
      try {
        if (!ownsLifecycle(generation)) return
        result = await input.transport.push(operation)
      } catch (error) {
        if (!ownsLifecycle(generation)) return
        const action = await handleRequestError(generation, error, operation)
        if (!ownsLifecycle(generation)) return
        if (action === 'continue') continue
        return
      }
      if (!ownsLifecycle(generation)) return
      await input.repository.acknowledgeOperation(operation.operationId, result, input.workspace)
      if (!ownsLifecycle(generation)) return
      pushed = true
    }

    if (pushed && (!ownsLifecycle(generation) || !await pullAndApply(generation))) return
    if (!ownsLifecycle(generation)) return
    const lastSyncedAt = now().toISOString()
    await input.workspace.db.put('sync_meta', { key: 'last_synced_at', value: lastSyncedAt })
    if (ownsLifecycle(generation)) setStatus(generation, { kind: 'idle', lastSyncedAt })
  }

  function requestLoop(generation: number): void {
    if (!ownsLifecycle(generation)) return
    queuedGeneration = generation
    if (loopPromise) return
    loopPromise = (async () => {
      while (queuedGeneration === generation && ownsLifecycle(generation)) {
        queuedGeneration = null
        await synchronize(generation)
      }
    })().finally(() => {
      loopPromise = null
      const nextGeneration = queuedGeneration
      if (nextGeneration !== null && ownsLifecycle(nextGeneration)) requestLoop(nextGeneration)
    })
  }

  async function waitForLoop(generation: number): Promise<void> {
    while (ownsLifecycle(generation)) {
      const activeLoop = loopPromise
      if (!activeLoop) return
      await activeLoop
      if (!ownsLifecycle(generation)) return
    }
  }

  const onlineListener = () => {
    connectionOnline = true
    engine.wake('online')
  }
  const visibilityListener = () => {
    if (document.visibilityState === 'visible') engine.wake('foreground')
  }

  function removeLocalListeners(): void {
    wakeUnsubscribe?.()
    wakeUnsubscribe = null
    if (typeof window !== 'undefined') window.removeEventListener('online', onlineListener)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilityListener)
  }

  const engine: SyncEngine = {
    async start(background = false) {
      if (running) {
        await waitForLoop(lifecycleGeneration)
        return
      }
      const generation = ++lifecycleGeneration
      running = true
      connectionOnline = typeof navigator === 'undefined' || navigator.onLine
      wakeUnsubscribe = subscribeSyncWake(reason => engine.wake(reason))
      if (typeof window !== 'undefined') window.addEventListener('online', onlineListener)
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibilityListener)

      if (!ownsLifecycle(generation)) return
      let unsubscribe: () => Promise<void>
      try {
        if (!ownsLifecycle(generation)) return
        unsubscribe = await input.transport.subscribe(
          () => {
            if (ownsLifecycle(generation)) engine.wake('realtime')
          },
          online => {
            if (!ownsLifecycle(generation)) return
            connectionOnline = online
            if (online) engine.wake('online')
          },
        )
      } catch (error) {
        if (ownsLifecycle(generation)) {
          await handleRequestError(generation, error)
          if (!ownsLifecycle(generation)) return
          lifecycleGeneration++
          removeLocalListeners()
          running = false
          queuedGeneration = null
        }
        return
      }
      if (!ownsLifecycle(generation)) {
        await unsubscribe()
        return
      }
      realtimeUnsubscribe = unsubscribe
      await reconcileIsolated(generation)
      requestLoop(generation)
      if (background) return
      await waitForLoop(generation)
    },

    wake(_reason) {
      requestLoop(lifecycleGeneration)
    },

    async stop() {
      if (!running) return
      lifecycleGeneration++
      running = false
      queuedGeneration = null
      const stoppingLoop = loopPromise
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      removeLocalListeners()
      const unsubscribe = realtimeUnsubscribe
      realtimeUnsubscribe = null
      if (unsubscribe) await unsubscribe()
      if (stoppingLoop) await stoppingLoop
    },
  }

  return engine
}

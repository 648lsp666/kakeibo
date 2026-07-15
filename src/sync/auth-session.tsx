import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { domainRepository, type DomainSnapshot } from './domain-repository'
import { getWorkspaceSnapshot, switchWorkspace, withWorkspaceWrite } from './local-db'
import { createSyncEngine, type SyncEngine } from './sync-engine'
import { getSupabaseClientIfConfigured } from './supabase-client'
import { createSupabaseTransport } from './supabase-transport'
import { useSyncStore } from './sync-store'

export interface AuthSyncContextValue {
  session: Session | null
  loading: boolean
  migrationRequired: boolean
  pending: number
  sendOtp(email: string): Promise<void>
  confirmMigration(): Promise<void>
  skipMigration(): Promise<void>
  signOut(): Promise<void>
  retry(): void
}

interface AnonymousMigrationService {
  prepare(userId: string): Promise<{ blob: Blob; snapshot: DomainSnapshot }>
  commit(userId: string, snapshot: DomainSnapshot): Promise<void>
  markSkipped(userId: string): Promise<void>
}

const AuthSyncContext = createContext<AuthSyncContextValue | null>(null)
const migrationMarker = (userId: string) => `anonymous_migration_complete:${userId}`

function createAnonymousMigrationService(): AnonymousMigrationService {
  return {
    async prepare(userId) {
      const snapshot = await domainRepository.exportSnapshot()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(blob)
      anchor.download = `kakeibo-before-account-${userId}.json`
      anchor.click()
      URL.revokeObjectURL(anchor.href)
      return { blob, snapshot }
    },

    async commit(userId, snapshot) {
      await switchWorkspace({ kind: 'user', userId })
      const timestamp = new Date().toISOString()
      try {
        await withWorkspaceWrite(
          ['transactions', 'categories', 'budgets', 'outbox', 'sync_meta'],
          async tx => {
            const transactions = tx.objectStore('transactions')
            const categories = tx.objectStore('categories')
            const budgets = tx.objectStore('budgets')
            const outbox = tx.objectStore('outbox')
            const meta = tx.objectStore('sync_meta')
            const current = await meta.get('outbox_sequence')
            let enqueueOrder = Number.parseInt(current?.value ?? '0', 10)

            const enqueue = async (
              entityType: 'transaction' | 'category' | 'budget',
              payload: DomainSnapshot['transactions'][number] | DomainSnapshot['categories'][number] | DomainSnapshot['budgets'][number],
            ) => {
              enqueueOrder++
              await outbox.add({
                operationId: nanoid(),
                entityType,
                entityId: payload.id,
                operation: 'upsert',
                payload,
                createdAt: timestamp,
                attemptCount: 0,
                nextAttemptAt: timestamp,
                state: 'pending',
                enqueueOrder,
              })
            }

            for (const transaction of snapshot.transactions) {
              await transactions.put(transaction)
              await enqueue('transaction', transaction)
            }
            for (const category of snapshot.categories) {
              await categories.put(category)
              if (!category.isSystem) await enqueue('category', category)
            }
            for (const budget of snapshot.budgets) {
              await budgets.put({ ...budget, revision: 0 })
              await enqueue('budget', budget)
            }
            if (enqueueOrder !== Number.parseInt(current?.value ?? '0', 10)) {
              await meta.put({ key: 'outbox_sequence', value: String(enqueueOrder) })
            }
          },
        )
      } catch (error) {
        await switchWorkspace({ kind: 'anonymous' })
        throw error
      }
      localStorage.setItem(migrationMarker(userId), 'complete')
    },

    async markSkipped(userId) {
      localStorage.setItem(migrationMarker(userId), 'skipped')
    },
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : '云同步操作失败，请重试'
}

export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const syncStatus = useSyncStore(state => state.status)
  const clientRef = useRef<SupabaseClient | null>(null)
  const engineRef = useRef<SyncEngine | null>(null)
  const generationRef = useRef(0)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const mountedRef = useRef(false)
  const pendingMigrationRef = useRef<{ userId: string; snapshot: DomainSnapshot } | null>(null)
  const migrationServiceRef = useRef<AnonymousMigrationService>(createAnonymousMigrationService())

  const owns = useCallback((generation: number) => mountedRef.current && generationRef.current === generation, [])

  const stopEngine = useCallback(async () => {
    const engine = engineRef.current
    engineRef.current = null
    if (engine) await engine.stop()
  }, [])

  const startAccount = useCallback(async (
    nextSession: Session,
    generation: number,
    workspaceReady = false,
  ) => {
    const userId = nextSession.user.id
    if (!workspaceReady) await switchWorkspace({ kind: 'user', userId })
    if (!owns(generation)) return
    const workspace = await getWorkspaceSnapshot()
    if (!owns(generation)) return
    const client = clientRef.current
    if (!client) return
    const engine = createSyncEngine({
      userId,
      workspace,
      transport: createSupabaseTransport(client, userId),
      repository: domainRepository,
    })
    engineRef.current = engine
    await engine.start()
    if (!owns(generation)) {
      if (engineRef.current === engine) engineRef.current = null
      await engine.stop()
      return
    }
    setSession(nextSession)
    setMigrationRequired(false)
    setLoading(false)
  }, [owns])

  const transition = useCallback(async (nextSession: Session | null, generation: number) => {
    await stopEngine()
    if (!owns(generation)) return

    if (!nextSession) {
      pendingMigrationRef.current = null
      await switchWorkspace({ kind: 'anonymous' })
      if (!owns(generation)) return
      useSyncStore.getState().setStatus({ kind: 'local-only' })
      setSession(null)
      setMigrationRequired(false)
      setLoading(false)
      return
    }

    const userId = nextSession.user.id
    if (!localStorage.getItem(migrationMarker(userId))) {
      try {
        const prepared = await migrationServiceRef.current.prepare(userId)
        if (!owns(generation)) return
        pendingMigrationRef.current = { userId, snapshot: prepared.snapshot }
        setSession(nextSession)
        setMigrationRequired(true)
        setLoading(false)
      } catch (error) {
        if (!owns(generation)) return
        pendingMigrationRef.current = null
        setSession(nextSession)
        setMigrationRequired(true)
        setLoading(false)
        useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
      }
      return
    }

    await startAccount(nextSession, generation)
  }, [owns, startAccount, stopEngine])

  const enqueue = useCallback((nextSession: Session | null) => {
    const generation = ++generationRef.current
    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(() => transition(nextSession, generation))
      .catch(error => {
        if (!owns(generation)) return
        setLoading(false)
        useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
      })
    return queueRef.current
  }, [owns, transition])

  useEffect(() => {
    mountedRef.current = true
    const client = getSupabaseClientIfConfigured()
    clientRef.current = client
    if (!client) {
      useSyncStore.getState().setStatus({ kind: 'local-only' })
      setLoading(false)
      return () => {
        mountedRef.current = false
        generationRef.current++
      }
    }

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      void enqueue(nextSession)
    })
    void client.auth.getSession().then(({ data: restored, error }) => {
      if (error) throw error
      return enqueue(restored.session)
    }).catch(error => {
      setLoading(false)
      useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
    })

    return () => {
      mountedRef.current = false
      generationRef.current++
      data.subscription.unsubscribe()
      void stopEngine()
    }
  }, [enqueue, stopEngine])

  const sendOtp = useCallback(async (email: string) => {
    const client = clientRef.current
    if (!client) throw new Error('云同步尚未配置')
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const confirmMigration = useCallback(async () => {
    const pendingMigration = pendingMigrationRef.current
    if (!session || !pendingMigration || pendingMigration.userId !== session.user.id) {
      if (session) await enqueue(session)
      return
    }
    const generation = ++generationRef.current
    setLoading(true)
    try {
      await migrationServiceRef.current.commit(pendingMigration.userId, pendingMigration.snapshot)
      if (!owns(generation)) return
      pendingMigrationRef.current = null
      await startAccount(session, generation, true)
    } catch (error) {
      if (!owns(generation)) return
      setLoading(false)
      setMigrationRequired(true)
      useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
    }
  }, [enqueue, owns, session, startAccount])

  const skipMigration = useCallback(async () => {
    if (!session) return
    const generation = ++generationRef.current
    setLoading(true)
    try {
      await migrationServiceRef.current.markSkipped(session.user.id)
      if (!owns(generation)) return
      pendingMigrationRef.current = null
      await startAccount(session, generation)
    } catch (error) {
      if (!owns(generation)) return
      setLoading(false)
      useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
    }
  }, [owns, session, startAccount])

  const signOut = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    const { error } = await client.auth.signOut()
    if (error) throw error
    await enqueue(null)
  }, [enqueue])

  const retry = useCallback(() => {
    if (migrationRequired && session) {
      void enqueue(session)
      return
    }
    engineRef.current?.wake('manual')
  }, [enqueue, migrationRequired, session])

  const value = useMemo<AuthSyncContextValue>(() => ({
    session,
    loading,
    migrationRequired,
    pending: 'pending' in syncStatus ? syncStatus.pending : 0,
    sendOtp,
    confirmMigration,
    skipMigration,
    signOut,
    retry,
  }), [confirmMigration, loading, migrationRequired, retry, sendOtp, session, signOut, skipMigration, syncStatus])

  return <AuthSyncContext.Provider value={value}>{children}</AuthSyncContext.Provider>
}

export function useAuthSync(): AuthSyncContextValue {
  const value = useContext(AuthSyncContext)
  if (!value) throw new Error('useAuthSync must be used inside AuthSyncProvider')
  return value
}

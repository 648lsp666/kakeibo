import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { domainRepository, type DomainSnapshot } from './domain-repository'
import {
  getWorkspaceSnapshot,
  isWorkspaceCurrent,
  outboxOps,
  switchWorkspace,
  withWorkspaceWrite,
  type WorkspaceSnapshot,
} from './local-db'
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
  prepareSignOut(): Promise<number>
  signOut(): Promise<void>
  retry(): void
}

interface AnonymousMigrationService {
  prepare(userId: string): Promise<{ blob: Blob; snapshot: DomainSnapshot }>
  commit(userId: string, snapshot: DomainSnapshot): Promise<void>
  markSkipped(userId: string): Promise<void>
}

interface EffectToken { active: boolean }
interface ActionToken {
  effect: EffectToken
  id: number
  requestId: number
  userId?: string
}

const AuthSyncContext = createContext<AuthSyncContextValue | null>(null)
const migrationMarker = (userId: string) => `anonymous_migration_complete:${userId}`

function createAnonymousMigrationService(
  assertTargetWorkspace: (userId: string) => Promise<WorkspaceSnapshot>,
): AnonymousMigrationService {
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
        await assertTargetWorkspace(userId)
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
            await meta.put({ key: migrationMarker(userId), value: 'complete' })
          },
        )
      } catch (error) {
        await switchWorkspace({ kind: 'anonymous' })
        throw error
      }
    },

    async markSkipped(userId) {
      await switchWorkspace({ kind: 'user', userId })
      try {
        await assertTargetWorkspace(userId)
        await withWorkspaceWrite(['sync_meta'], async tx => {
          await tx.objectStore('sync_meta').put({ key: migrationMarker(userId), value: 'skipped' })
        })
      } catch (error) {
        await switchWorkspace({ kind: 'anonymous' })
        throw error
      }
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
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const activeEffectRef = useRef<EffectToken | null>(null)
  const currentActionRef = useRef<ActionToken | null>(null)
  const actionIdRef = useRef(0)
  const requestIdRef = useRef(0)
  const pendingMigrationRef = useRef<{ userId: string; snapshot: DomainSnapshot } | null>(null)
  const desiredSessionRef = useRef<Session | null>(null)

  const effectIsActive = useCallback((effect: EffectToken) => (
    effect.active && activeEffectRef.current === effect
  ), [])
  const ownsAction = useCallback((token: ActionToken) => (
    effectIsActive(token.effect) && currentActionRef.current === token
  ), [effectIsActive])
  const mayExposeAction = useCallback((token: ActionToken) => (
    ownsAction(token) && token.requestId === requestIdRef.current
  ), [ownsAction])

  const stopEngine = useCallback(async () => {
    const engine = engineRef.current
    engineRef.current = null
    if (engine) await engine.stop()
  }, [])

  const assertTargetWorkspace = useCallback(async (token: ActionToken, userId: string) => {
    if (!ownsAction(token) || token.userId !== userId) throw new Error('Account lifecycle changed')
    const workspace = await getWorkspaceSnapshot()
    if (!ownsAction(token)
      || workspace.id.kind !== 'user'
      || workspace.id.userId !== userId) {
      throw new Error('Account workspace changed')
    }
    return workspace
  }, [ownsAction])

  const enqueueAction = useCallback((
    effect: EffectToken,
    action: (token: ActionToken) => Promise<void>,
  ): Promise<void> => {
    if (!effectIsActive(effect)) return Promise.resolve()
    const requestId = ++requestIdRef.current
    setLoading(true)
    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!effectIsActive(effect)) return
        const token: ActionToken = { effect, id: ++actionIdRef.current, requestId }
        currentActionRef.current = token
        try {
          await action(token)
        } finally {
          if (currentActionRef.current === token) currentActionRef.current = null
        }
      })
    return queueRef.current
  }, [effectIsActive])

  const startAccount = useCallback(async (
    nextSession: Session,
    token: ActionToken,
    workspaceReady = false,
  ) => {
    const userId = nextSession.user.id
    token.userId = userId
    if (!workspaceReady) await switchWorkspace({ kind: 'user', userId })
    const workspace = await assertTargetWorkspace(token, userId)
    if (!mayExposeAction(token)) return
    const client = clientRef.current
    if (!client) throw new Error('云同步尚未配置')
    const engine = createSyncEngine({
      userId,
      workspace,
      transport: createSupabaseTransport(client, userId),
      repository: domainRepository,
    })
    engineRef.current = engine
    await engine.start()
    if (!mayExposeAction(token)) {
      if (engineRef.current === engine) engineRef.current = null
      await engine.stop()
      return
    }
    setSession(nextSession)
    setMigrationRequired(false)
    setLoading(false)
  }, [assertTargetWorkspace, mayExposeAction])

  const recoverLifecycle = useCallback(async (
    nextSession: Session | null,
    token: ActionToken,
    error: unknown,
  ) => {
    await stopEngine()
    if (!ownsAction(token)) return
    await switchWorkspace({ kind: 'anonymous' })
    if (!mayExposeAction(token)) return
    setSession(nextSession)
    setMigrationRequired(false)
    setLoading(true)
    useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
  }, [mayExposeAction, ownsAction, stopEngine])

  const transition = useCallback(async (nextSession: Session | null, token: ActionToken) => {
    let preparingMigration = false
    await stopEngine()
    if (!ownsAction(token)) return

    if (!nextSession) {
      pendingMigrationRef.current = null
      await switchWorkspace({ kind: 'anonymous' })
      if (!mayExposeAction(token)) return
      useSyncStore.getState().setStatus({ kind: 'local-only' })
      setSession(null)
      setMigrationRequired(false)
      setLoading(false)
      return
    }

    const userId = nextSession.user.id
    token.userId = userId
    try {
      await switchWorkspace({ kind: 'user', userId })
      const target = await assertTargetWorkspace(token, userId)
      const marker = await target.db.get('sync_meta', migrationMarker(userId))
      if (!ownsAction(token)) return
      if (marker) {
        await startAccount(nextSession, token, true)
        return
      }

      preparingMigration = true
      await switchWorkspace({ kind: 'anonymous' })
      if (!ownsAction(token)) return
      const anonymous = await getWorkspaceSnapshot()
      if (!ownsAction(token) || anonymous.id.kind !== 'anonymous') throw new Error('Anonymous workspace changed')
      const migration = createAnonymousMigrationService(id => assertTargetWorkspace(token, id))
      const prepared = await migration.prepare(userId)
      if (!mayExposeAction(token)) return
      pendingMigrationRef.current = { userId, snapshot: prepared.snapshot }
      setSession(nextSession)
      setMigrationRequired(true)
      setLoading(false)
    } catch (error) {
      if (!ownsAction(token)) return
      if (preparingMigration || pendingMigrationRef.current?.userId === userId) {
        if (!mayExposeAction(token)) return
        setSession(nextSession)
        setMigrationRequired(true)
        setLoading(false)
        useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
        return
      }
      await recoverLifecycle(nextSession, token, error)
    }
  }, [assertTargetWorkspace, mayExposeAction, ownsAction, recoverLifecycle, startAccount, stopEngine])

  const scheduleTransition = useCallback((effect: EffectToken, nextSession: Session | null) => {
    if (!effectIsActive(effect)) return Promise.resolve()
    desiredSessionRef.current = nextSession
    return enqueueAction(effect, async token => {
      try {
        await transition(nextSession, token)
      } catch (error) {
        if (ownsAction(token)) await recoverLifecycle(nextSession, token, error)
      }
    })
  }, [effectIsActive, enqueueAction, ownsAction, recoverLifecycle, transition])

  useEffect(() => {
    const effect: EffectToken = { active: true }
    activeEffectRef.current = effect
    let lastAuthIdentity: string | null | undefined
    const acceptAuthSession = (nextSession: Session | null) => {
      if (!effectIsActive(effect)) return
      const identity = nextSession?.user.id ?? null
      if (lastAuthIdentity === identity) return
      lastAuthIdentity = identity
      void scheduleTransition(effect, nextSession)
    }
    const client = getSupabaseClientIfConfigured()
    clientRef.current = client
    if (!client) {
      desiredSessionRef.current = null
      useSyncStore.getState().setStatus({ kind: 'local-only' })
      setLoading(false)
      return () => {
        effect.active = false
        if (activeEffectRef.current === effect) activeEffectRef.current = null
      }
    }

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      acceptAuthSession(nextSession)
    })
    void client.auth.getSession().then(({ data: restored, error }) => {
      if (!effectIsActive(effect)) return
      if (error) throw error
      acceptAuthSession(restored.session)
    }).catch(error => {
      if (!effectIsActive(effect)) return
      setLoading(true)
      useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
    })

    return () => {
      effect.active = false
      if (activeEffectRef.current === effect) activeEffectRef.current = null
      data.subscription.unsubscribe()
      void stopEngine()
    }
  }, [effectIsActive, scheduleTransition, stopEngine])

  const sendOtp = useCallback(async (email: string) => {
    const client = clientRef.current
    if (!client) throw new Error('云同步尚未配置')
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const confirmMigration = useCallback(() => {
    const effect = activeEffectRef.current
    const pending = pendingMigrationRef.current
    const accountSession = session
    if (!effect || !accountSession) return Promise.resolve()
    return enqueueAction(effect, async token => {
      token.userId = accountSession.user.id
      if (!pending || pending.userId !== accountSession.user.id) {
        await transition(accountSession, token)
        return
      }
      let markerDurable = false
      try {
        const migration = createAnonymousMigrationService(id => assertTargetWorkspace(token, id))
        await migration.commit(pending.userId, pending.snapshot)
        markerDurable = true
        if (!ownsAction(token)) return
        pendingMigrationRef.current = null
        if (mayExposeAction(token)) await startAccount(accountSession, token, true)
      } catch (error) {
        if (!mayExposeAction(token)) return
        if (markerDurable) {
          await recoverLifecycle(accountSession, token, error)
          return
        }
        setSession(accountSession)
        setMigrationRequired(true)
        setLoading(false)
        useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
      }
    })
  }, [assertTargetWorkspace, enqueueAction, mayExposeAction, ownsAction, recoverLifecycle, session, startAccount, transition])

  const skipMigration = useCallback(() => {
    const effect = activeEffectRef.current
    const accountSession = session
    if (!effect || !accountSession) return Promise.resolve()
    return enqueueAction(effect, async token => {
      token.userId = accountSession.user.id
      let markerDurable = false
      try {
        const migration = createAnonymousMigrationService(id => assertTargetWorkspace(token, id))
        await migration.markSkipped(accountSession.user.id)
        markerDurable = true
        if (!ownsAction(token)) return
        pendingMigrationRef.current = null
        if (mayExposeAction(token)) await startAccount(accountSession, token, true)
      } catch (error) {
        if (!mayExposeAction(token)) return
        if (markerDurable) {
          await recoverLifecycle(accountSession, token, error)
          return
        }
        setLoading(false)
        setMigrationRequired(true)
        useSyncStore.getState().setStatus({ kind: 'error', pending: 0, message: message(error) })
      }
    })
  }, [assertTargetWorkspace, enqueueAction, mayExposeAction, ownsAction, recoverLifecycle, session, startAccount])

  const prepareSignOut = useCallback(async () => {
    if (!session) return 0
    const workspace = await getWorkspaceSnapshot()
    if (workspace.id.kind !== 'user' || workspace.id.userId !== session.user.id) {
      throw new Error('Account workspace changed')
    }
    const pending = await outboxOps.countPending()
    if (!isWorkspaceCurrent(workspace)) throw new Error('Account workspace changed')
    return pending
  }, [session])

  const signOut = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    const { error } = await client.auth.signOut()
    if (error) throw error
  }, [])

  const retry = useCallback(() => {
    const effect = activeEffectRef.current
    if (effect && desiredSessionRef.current) {
      void scheduleTransition(effect, desiredSessionRef.current)
      return
    }
    engineRef.current?.wake('manual')
  }, [scheduleTransition])

  const value = useMemo<AuthSyncContextValue>(() => ({
    session,
    loading,
    migrationRequired,
    pending: 'pending' in syncStatus ? syncStatus.pending : 0,
    sendOtp,
    confirmMigration,
    skipMigration,
    prepareSignOut,
    signOut,
    retry,
  }), [confirmMigration, loading, migrationRequired, prepareSignOut, retry, sendOtp, session, signOut, skipMigration, syncStatus])

  return <AuthSyncContext.Provider value={value}>{children}</AuthSyncContext.Provider>
}

export function useAuthSync(): AuthSyncContextValue {
  const value = useContext(AuthSyncContext)
  if (!value) throw new Error('useAuthSync must be used inside AuthSyncProvider')
  return value
}

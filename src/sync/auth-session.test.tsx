import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthSyncProvider, useAuthSync } from './auth-session'

type WorkspaceId = { kind: 'anonymous' } | { kind: 'user'; userId: string }
type Rows = Record<'transactions' | 'categories' | 'budgets' | 'outbox' | 'sync_meta', any[]>

const mocks = vi.hoisted(() => ({
  active: { kind: 'anonymous' } as WorkspaceId,
  workspaces: {} as Record<string, Rows>,
  failMarker: false,
  client: null as any,
  exportSnapshot: vi.fn(),
  getClient: vi.fn(),
  getWorkspaceSnapshot: vi.fn(),
  switchWorkspace: vi.fn(),
  withWorkspaceWrite: vi.fn(),
  countPending: vi.fn(),
  createEngine: vi.fn(),
  createTransport: vi.fn(),
  setStatus: vi.fn(),
}))

vi.mock('./supabase-client', () => ({ getSupabaseClientIfConfigured: mocks.getClient }))
vi.mock('./domain-repository', () => ({
  domainRepository: {
    exportSnapshot: mocks.exportSnapshot,
    applyCloudRecords: vi.fn(),
    acknowledgeOperation: vi.fn(),
  },
}))
vi.mock('./local-db', () => ({
  getWorkspaceSnapshot: mocks.getWorkspaceSnapshot,
  switchWorkspace: mocks.switchWorkspace,
  withWorkspaceWrite: mocks.withWorkspaceWrite,
  outboxOps: { countPending: mocks.countPending },
  isWorkspaceCurrent: vi.fn().mockReturnValue(true),
}))
vi.mock('./sync-engine', () => ({ createSyncEngine: mocks.createEngine }))
vi.mock('./supabase-transport', () => ({ createSupabaseTransport: mocks.createTransport }))
vi.mock('./sync-store', () => ({
  useSyncStore: Object.assign(
    (selector: (state: any) => unknown) => selector({ status: { kind: 'local-only' } }),
    { getState: () => ({ setStatus: mocks.setStatus }) },
  ),
}))

const emptySnapshot = { transactions: [], categories: [], budgets: [] }
const markerKey = (userId: string) => `anonymous_migration_complete:${userId}`
const workspaceName = (id: WorkspaceId) => id.kind === 'anonymous' ? 'anonymous' : id.userId
const freshRows = (): Rows => ({ transactions: [], categories: [], budgets: [], outbox: [], sync_meta: [] })
const rowsFor = (id: WorkspaceId) => mocks.workspaces[workspaceName(id)] ??= freshRows()

function session(userId = 'user-1', email: string | null = 'reader@example.com'): Session {
  return { user: { id: userId, email } } as Session
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function createAuthClient(restored: Session | null | Promise<{ data: { session: Session | null }; error: null }>) {
  const listeners = new Set<(event: string, session: Session | null) => void>()
  const getSession = restored instanceof Promise
    ? vi.fn(() => restored)
    : vi.fn().mockResolvedValue({ data: { session: restored }, error: null })
  const auth = {
    getSession,
    onAuthStateChange: vi.fn((callback) => {
      listeners.add(callback)
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
    }),
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockImplementation(async () => {
      for (const listener of listeners) listener('SIGNED_OUT', null)
      return { error: null }
    }),
  }
  return {
    auth,
    emit(event: string, next: Session | null) {
      for (const listener of listeners) listener(event, next)
    },
  }
}

function Harness() {
  const auth = useAuthSync()
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="email">{auth.session?.user.email ?? 'anonymous'}</span>
      <span data-testid="migration">{String(auth.migrationRequired)}</span>
      <span data-testid="isolated">{String(auth.isolated)}</span>
      <button onClick={() => void auth.sendOtp('reader@example.com')}>otp</button>
      <button onClick={() => void auth.confirmMigration()}>confirm</button>
      <button onClick={() => void auth.skipMigration()}>skip</button>
      <button onClick={() => void auth.prepareSignOut()}>prepare-sign-out</button>
      <button onClick={() => auth.retry()}>retry</button>
      <button onClick={() => void auth.signOut()}>sign-out</button>
    </div>
  )
}

function installMarker(userId: string, value = 'complete') {
  rowsFor({ kind: 'user', userId }).sync_meta.push({ key: markerKey(userId), value })
}

describe('AuthSyncProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.active = { kind: 'anonymous' }
    mocks.workspaces = {}
    mocks.failMarker = false
    mocks.exportSnapshot.mockResolvedValue(emptySnapshot)
    mocks.switchWorkspace.mockImplementation(async (id: WorkspaceId) => { mocks.active = id })
    mocks.getWorkspaceSnapshot.mockImplementation(async () => {
      const id = mocks.active
      const rows = rowsFor(id)
      return {
        id,
        generation: 1,
        db: {
          get: async (store: keyof Rows, key: string) => rows[store].find(row => row.key === key || row.id === key),
          countFromIndex: async () => rows.outbox.filter(row => row.state === 'pending').length,
        },
      }
    })
    mocks.withWorkspaceWrite.mockImplementation(async (_stores, callback) => {
      const target = rowsFor(mocks.active)
      const staged = structuredClone(target) as Rows
      const objectStore = (name: keyof Rows) => ({
        get: async (key: string) => staged[name].find(row => row.key === key || row.operationId === key),
        put: async (row: any) => {
          if (name === 'sync_meta' && row.key?.startsWith('anonymous_migration_complete:') && mocks.failMarker) {
            throw new Error('marker write failed')
          }
          const key = row.id ?? row.key ?? row.operationId
          const index = staged[name].findIndex(existing => (existing.id ?? existing.key ?? existing.operationId) === key)
          if (index >= 0) staged[name][index] = row
          else staged[name].push(row)
        },
        add: async (row: any) => { staged[name].push(row) },
      })
      const result = await callback({ objectStore })
      mocks.workspaces[workspaceName(mocks.active)] = staged
      return result
    })
    mocks.countPending.mockImplementation(async () => rowsFor(mocks.active).outbox.filter(row => row.state === 'pending').length)
    mocks.createTransport.mockReturnValue({})
    mocks.createEngine.mockReset()
    mocks.createEngine.mockReturnValue({ start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('keeps missing cloud configuration anonymous and usable', async () => {
    mocks.getClient.mockReturnValue(null)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(mocks.active).toEqual({ kind: 'anonymous' })
    expect(mocks.createEngine).not.toHaveBeenCalled()
  })

  it('makes the signed-in local workspace usable while the first pull is still pending', async () => {
    installMarker('user-1')
    const client = createAuthClient(session())
    mocks.getClient.mockReturnValue(client as any)
    const start = vi.fn((background?: boolean) => background ? Promise.resolve() : new Promise<void>(() => undefined))
    mocks.createEngine.mockReturnValue({ start, stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() })
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('reader@example.com'))
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(start).toHaveBeenCalledWith(true)
  })

  it('uses a magic-link OTP redirect to the current web origin', async () => {
    const client = createAuthClient(null)
    mocks.getClient.mockReturnValue(client as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    await userEvent.click(screen.getByRole('button', { name: 'otp' }))
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'reader@example.com', options: { emailRedirectTo: window.location.origin },
    })
  })

  it('checks the target marker then returns to anonymous before preparing first-login backup', async () => {
    const client = createAuthClient(session())
    mocks.getClient.mockReturnValue(client as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)

    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))
    expect(mocks.switchWorkspace.mock.calls.map(call => call[0])).toEqual([
      { kind: 'user', userId: 'user-1' }, { kind: 'anonymous' },
    ])
    expect(mocks.exportSnapshot).toHaveBeenCalledOnce()
    expect(mocks.active).toEqual({ kind: 'anonymous' })
    expect(mocks.createEngine).not.toHaveBeenCalled()
  })

  it('atomically imports stable IDs and marker, keeping system categories out of outbox', async () => {
    const richSnapshot = {
      transactions: [{ id: 'tx-stable', amount: 12 }],
      categories: [{ id: 'system-stable', isSystem: true }, { id: 'custom-stable', isSystem: false }],
      budgets: [{ id: 'budget-stable', amount: 100 }],
    } as any
    const client = createAuthClient(session())
    mocks.getClient.mockReturnValue(client as any)
    mocks.exportSnapshot.mockResolvedValue(richSnapshot)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))

    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.createEngine).toHaveBeenCalledOnce())
    const rows = rowsFor({ kind: 'user', userId: 'user-1' })
    expect(rows.sync_meta).toContainEqual({ key: markerKey('user-1'), value: 'complete' })
    expect(rows.outbox.map(row => row.entityId)).toEqual(['tx-stable', 'custom-stable', 'budget-stable'])
    expect(rows.categories.map(row => row.id)).toEqual(['system-stable', 'custom-stable'])
    expect(localStorage.getItem(markerKey('user-1'))).toBeNull()
  })

  it('stores an explicit skip marker in the target workspace without importing anonymous rows', async () => {
    const client = createAuthClient(session())
    mocks.getClient.mockReturnValue(client as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))

    await userEvent.click(screen.getByRole('button', { name: 'skip' }))

    await waitFor(() => expect(mocks.createEngine).toHaveBeenCalledOnce())
    const rows = rowsFor({ kind: 'user', userId: 'user-1' })
    expect(rows.sync_meta).toContainEqual({ key: markerKey('user-1'), value: 'skipped' })
    expect(rows.transactions).toHaveLength(0)
    expect(rows.outbox).toHaveLength(0)
  })

  it('rolls back rows, outbox, and marker together when marker write fails, then retries without duplicates', async () => {
    const client = createAuthClient(session())
    mocks.getClient.mockReturnValue(client as any)
    mocks.exportSnapshot.mockResolvedValue({ transactions: [{ id: 'tx-1' }], categories: [], budgets: [] } as any)
    mocks.failMarker = true
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))

    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(expect.objectContaining({ message: 'marker write failed' })))
    expect(rowsFor({ kind: 'user', userId: 'user-1' })).toEqual(freshRows())
    expect(mocks.active).toEqual({ kind: 'anonymous' })

    mocks.failMarker = false
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))
    await waitFor(() => expect(mocks.createEngine).toHaveBeenCalledOnce())
    const rows = rowsFor({ kind: 'user', userId: 'user-1' })
    expect(rows.transactions).toHaveLength(1)
    expect(rows.outbox).toHaveLength(1)
    expect(rows.sync_meta.filter(row => row.key === markerKey('user-1'))).toHaveLength(1)
  })

  it('recovers behind the workspace gate when confirm persisted the marker but engine start fails', async () => {
    const client = createAuthClient(session())
    const failed = { start: vi.fn().mockRejectedValue(new Error('confirm engine failed')), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    const recovered = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    mocks.getClient.mockReturnValue(client as any)
    mocks.createEngine.mockReturnValueOnce(failed).mockReturnValueOnce(recovered)
    mocks.exportSnapshot.mockResolvedValue({ transactions: [{ id: 'tx-1' }], categories: [], budgets: [] } as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))

    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(expect.objectContaining({ message: 'confirm engine failed' })))
    expect(rowsFor({ kind: 'user', userId: 'user-1' }).sync_meta).toContainEqual({ key: markerKey('user-1'), value: 'complete' })
    expect(failed.stop).toHaveBeenCalledOnce()
    expect(mocks.active).toEqual({ kind: 'anonymous' })
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    expect(screen.getByTestId('migration')).toHaveTextContent('false')

    await userEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(mocks.active).toEqual({ kind: 'user', userId: 'user-1' })
    expect(recovered.start).toHaveBeenCalledOnce()
  })

  it('recovers behind the workspace gate when skip persisted the marker but engine start fails', async () => {
    const client = createAuthClient(session())
    const failed = { start: vi.fn().mockRejectedValue(new Error('skip engine failed')), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    const recovered = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    mocks.getClient.mockReturnValue(client as any)
    mocks.createEngine.mockReturnValueOnce(failed).mockReturnValueOnce(recovered)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))

    await userEvent.click(screen.getByRole('button', { name: 'skip' }))

    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(expect.objectContaining({ message: 'skip engine failed' })))
    expect(rowsFor({ kind: 'user', userId: 'user-1' }).sync_meta).toContainEqual({ key: markerKey('user-1'), value: 'skipped' })
    expect(failed.stop).toHaveBeenCalledOnce()
    expect(mocks.active).toEqual({ kind: 'anonymous' })
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    expect(screen.getByTestId('migration')).toHaveTextContent('false')

    await userEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(mocks.active).toEqual({ kind: 'user', userId: 'user-1' })
    expect(recovered.start).toHaveBeenCalledOnce()
  })

  it('serializes A confirmation before a queued B auth transition', async () => {
    const client = createAuthClient(session('user-a', 'a@example.com'))
    mocks.getClient.mockReturnValue(client as any)
    mocks.exportSnapshot.mockResolvedValue({ transactions: [{ id: 'a-tx' }], categories: [], budgets: [] } as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))

    const switchingA = deferred<void>()
    mocks.switchWorkspace.mockImplementationOnce(async (id: WorkspaceId) => {
      await switchingA.promise
      mocks.active = id
    })
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))
    act(() => client.emit('SIGNED_IN', session('user-b', 'b@example.com')))
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    switchingA.resolve()

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('b@example.com'))
    expect(rowsFor({ kind: 'user', userId: 'user-a' }).transactions).toContainEqual(expect.objectContaining({ id: 'a-tx' }))
    expect(rowsFor({ kind: 'user', userId: 'user-b' }).transactions).toHaveLength(0)
  })

  it('does not import when the post-switch workspace snapshot belongs to another account', async () => {
    const client = createAuthClient(session('user-a', 'a@example.com'))
    mocks.getClient.mockReturnValue(client as any)
    mocks.exportSnapshot.mockResolvedValue({ transactions: [{ id: 'a-tx' }], categories: [], budgets: [] } as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))
    mocks.withWorkspaceWrite.mockClear()
    mocks.getWorkspaceSnapshot.mockResolvedValueOnce({
      id: { kind: 'user', userId: 'user-b' }, generation: 2, db: {},
    })

    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(expect.objectContaining({ message: 'Account workspace changed' })))
    expect(mocks.withWorkspaceWrite).not.toHaveBeenCalled()
    expect(mocks.active).toEqual({ kind: 'anonymous' })
  })

  it('ignores a stale StrictMode getSession resolution after its effect cleanup', async () => {
    const oldSession = deferred<{ data: { session: Session | null }; error: null }>()
    const client = createAuthClient(oldSession.promise)
    client.auth.getSession
      .mockImplementationOnce(() => oldSession.promise)
      .mockResolvedValueOnce({ data: { session: null }, error: null })
    mocks.getClient.mockReturnValue(client as any)
    render(<StrictMode><AuthSyncProvider><Harness /></AuthSyncProvider></StrictMode>)
    await waitFor(() => expect(client.auth.getSession).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    mocks.switchWorkspace.mockClear()

    oldSession.resolve({ data: { session: session('stale-user') }, error: null })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(mocks.switchWorkspace).not.toHaveBeenCalledWith({ kind: 'user', userId: 'stale-user' })
    expect(screen.getByTestId('email')).toHaveTextContent('anonymous')
  })

  it('ignores a stale StrictMode getSession rejection after its effect cleanup', async () => {
    const oldSession = deferred<{ data: { session: Session | null }; error: null }>()
    const client = createAuthClient(oldSession.promise)
    client.auth.getSession
      .mockImplementationOnce(() => oldSession.promise)
      .mockResolvedValueOnce({ data: { session: null }, error: null })
    mocks.getClient.mockReturnValue(client as any)
    render(<StrictMode><AuthSyncProvider><Harness /></AuthSyncProvider></StrictMode>)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    mocks.setStatus.mockClear()

    oldSession.reject(new Error('stale auth failure'))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(mocks.setStatus).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'stale auth failure' }))
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('deduplicates INITIAL_SESSION and getSession for the same account', async () => {
    const restored = deferred<{ data: { session: Session | null }; error: null }>()
    const client = createAuthClient(restored.promise)
    mocks.getClient.mockReturnValue(client as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)

    act(() => client.emit('INITIAL_SESSION', session()))
    restored.resolve({ data: { session: session() }, error: null })

    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))
    await waitFor(() => expect(mocks.exportSnapshot).toHaveBeenCalledTimes(1))
  })

  it('starts a marked account workspace before exposing it', async () => {
    installMarker('user-1')
    const client = createAuthClient(session())
    mocks.getClient.mockReturnValue(client as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(mocks.active).toEqual({ kind: 'user', userId: 'user-1' })
    expect(mocks.createEngine).toHaveBeenCalledOnce()
  })

  it('returns to an anonymous gated retry state when engine start fails', async () => {
    installMarker('user-1')
    const client = createAuthClient(session())
    const failed = { start: vi.fn().mockRejectedValue(new Error('engine failed')), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    const recovered = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    mocks.createEngine.mockReturnValueOnce(failed).mockReturnValueOnce(recovered)
    mocks.getClient.mockReturnValue(client as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)

    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(expect.objectContaining({ message: 'engine failed' })))
    expect(mocks.active).toEqual({ kind: 'anonymous' })
    expect(screen.getByTestId('loading')).toHaveTextContent('true')

    await userEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(mocks.active).toEqual({ kind: 'user', userId: 'user-1' })
  })

  it('reads pending count from the bound workspace and stops before sign-out switch', async () => {
    installMarker('user-1')
    rowsFor({ kind: 'user', userId: 'user-1' }).outbox.push({ operationId: 'op-1', state: 'pending' })
    const order: string[] = []
    const client = createAuthClient(session())
    const engine = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(async () => { order.push('stop') }), wake: vi.fn() }
    mocks.createEngine.mockReturnValue(engine)
    mocks.getClient.mockReturnValue(client as any)
    mocks.switchWorkspace.mockImplementation(async (id: WorkspaceId) => { mocks.active = id; order.push(id.kind) })
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    await userEvent.click(screen.getByRole('button', { name: 'prepare-sign-out' }))
    expect(mocks.countPending).toHaveBeenCalledOnce()
    order.length = 0
    await userEvent.click(screen.getByRole('button', { name: 'sign-out' }))
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('anonymous'))
    expect(order).toEqual(['stop', 'anonymous'])
  })
})

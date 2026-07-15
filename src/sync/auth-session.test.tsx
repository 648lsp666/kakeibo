import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthSyncProvider, useAuthSync } from './auth-session'

const mocks = vi.hoisted(() => ({
  client: null as any,
  exportSnapshot: vi.fn(),
  getClient: vi.fn(),
  getWorkspaceSnapshot: vi.fn(),
  switchWorkspace: vi.fn(),
  withWorkspaceWrite: vi.fn(),
  createEngine: vi.fn(),
  createTransport: vi.fn(),
  setStatus: vi.fn(),
}))

vi.mock('./supabase-client', () => ({
  getSupabaseClientIfConfigured: mocks.getClient,
}))
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
}))
vi.mock('./sync-engine', () => ({ createSyncEngine: mocks.createEngine }))
vi.mock('./supabase-transport', () => ({ createSupabaseTransport: mocks.createTransport }))
vi.mock('./sync-store', () => ({
  useSyncStore: Object.assign(
    (selector: (state: any) => unknown) => selector({ status: { kind: 'local-only' } }),
    { getState: () => ({ setStatus: mocks.setStatus }) },
  ),
}))

const snapshot = { transactions: [], categories: [], budgets: [] }

function session(userId = 'user-1', email = 'reader@example.com'): Session {
  return { user: { id: userId, email } } as Session
}

function createAuthClient(restored: Session | null) {
  let listener: ((event: string, session: Session | null) => void) | undefined
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: restored }, error: null }),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockImplementation(async () => {
      listener?.('SIGNED_OUT', null)
      return { error: null }
    }),
  }
  return { auth, emit: (event: string, next: Session | null) => listener?.(event, next) }
}

function Harness() {
  const auth = useAuthSync()
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="email">{auth.session?.user.email ?? 'anonymous'}</span>
      <span data-testid="migration">{String(auth.migrationRequired)}</span>
      <button onClick={() => void auth.sendOtp('reader@example.com')}>otp</button>
      <button onClick={() => void auth.confirmMigration()}>confirm</button>
      <button onClick={() => void auth.skipMigration()}>skip</button>
      <button onClick={() => void auth.signOut()}>sign-out</button>
    </div>
  )
}

describe('AuthSyncProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.exportSnapshot.mockResolvedValue(snapshot)
    mocks.switchWorkspace.mockResolvedValue(undefined)
    mocks.getWorkspaceSnapshot.mockResolvedValue({ id: { kind: 'user', userId: 'user-1' }, generation: 1, db: {} })
    mocks.createTransport.mockReturnValue({})
    mocks.createEngine.mockReturnValue({ start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() })
    mocks.withWorkspaceWrite.mockImplementation(async (_stores, callback) => {
      const stores = new Map<string, any>()
      const store = (name: string) => {
        if (!stores.has(name)) stores.set(name, {
          put: vi.fn().mockResolvedValue(undefined),
          add: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue(undefined),
        })
        return stores.get(name)
      }
      return callback({ objectStore: store })
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('keeps the app anonymous and local-only when cloud env is missing', async () => {
    mocks.getClient.mockReturnValue(null)

    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('email')).toHaveTextContent('anonymous')
    expect(mocks.createEngine).not.toHaveBeenCalled()
    expect(mocks.setStatus).toHaveBeenCalledWith({ kind: 'local-only' })
  })

  it('uses a magic-link OTP redirect to the current web origin', async () => {
    const authClient = createAuthClient(null)
    mocks.client = authClient
    mocks.getClient.mockReturnValue(authClient as any)
    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    await userEvent.click(screen.getByRole('button', { name: 'otp' }))

    expect(authClient.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'reader@example.com',
      options: { emailRedirectTo: window.location.origin },
    })
  })

  it('waits for a first-login decision before switching workspace or starting an engine', async () => {
    const authClient = createAuthClient(session())
    mocks.getClient.mockReturnValue(authClient as any)

    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)

    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))
    expect(mocks.exportSnapshot).toHaveBeenCalledOnce()
    expect(mocks.switchWorkspace).not.toHaveBeenCalled()
    expect(mocks.createEngine).not.toHaveBeenCalled()
  })

  it('exports, confirms, atomically imports stable IDs, marks complete, then starts the engine', async () => {
    const richSnapshot = {
      transactions: [{ id: 'tx-stable', amount: 12 }],
      categories: [
        { id: 'system-stable', isSystem: true },
        { id: 'custom-stable', isSystem: false },
      ],
      budgets: [{ id: 'budget-stable', amount: 100 }],
    } as any
    const order: string[] = []
    const authClient = createAuthClient(session())
    const engine = { start: vi.fn(async () => { order.push('start') }), stop: vi.fn(), wake: vi.fn() }
    mocks.getClient.mockReturnValue(authClient as any)
    mocks.exportSnapshot.mockImplementation(async () => { order.push('export'); return richSnapshot })
    mocks.switchWorkspace.mockImplementation(async () => { order.push('switch') })
    mocks.withWorkspaceWrite.mockImplementation(async (_stores, callback) => {
      order.push('import')
      const rows: Record<string, any[]> = { transactions: [], categories: [], budgets: [], outbox: [], sync_meta: [] }
      const objectStore = (name: string) => ({
        put: async (row: any) => { rows[name].push(row) },
        add: async (row: any) => { rows[name].push(row) },
        get: async () => undefined,
      })
      await callback({ objectStore })
      const outbox = rows.outbox
      expect(outbox.map(row => row.entityId)).toEqual(['tx-stable', 'custom-stable', 'budget-stable'])
      expect(rows.categories.map(row => row.id)).toEqual(['system-stable', 'custom-stable'])
    })
    mocks.createEngine.mockReturnValue(engine)

    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(engine.start).toHaveBeenCalledOnce())
    expect(order).toEqual(['export', 'switch', 'import', 'start'])
    expect(localStorage.getItem('anonymous_migration_complete:user-1')).toBe('complete')
  })

  it('does not mark or start when migration import fails and allows retry', async () => {
    const authClient = createAuthClient(session())
    mocks.getClient.mockReturnValue(authClient as any)
    mocks.withWorkspaceWrite.mockRejectedValueOnce(new Error('import failed'))

    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(screen.getByTestId('migration')).toHaveTextContent('true'))
    await userEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(mocks.setStatus).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', message: 'import failed' })))
    expect(localStorage.getItem('anonymous_migration_complete:user-1')).toBeNull()
    expect(mocks.createEngine).not.toHaveBeenCalled()
    expect(mocks.switchWorkspace).toHaveBeenLastCalledWith({ kind: 'anonymous' })
  })

  it('stops the account engine before returning to anonymous workspace on sign-out', async () => {
    localStorage.setItem('anonymous_migration_complete:user-1', 'complete')
    const order: string[] = []
    const authClient = createAuthClient(session())
    const engine = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(async () => { order.push('stop') }),
      wake: vi.fn(),
    }
    mocks.getClient.mockReturnValue(authClient as any)
    mocks.createEngine.mockReturnValue(engine)
    mocks.switchWorkspace.mockImplementation(async (workspace) => {
      order.push(workspace.kind === 'anonymous' ? 'anonymous' : 'user')
    })

    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(engine.start).toHaveBeenCalledOnce())
    order.length = 0
    await userEvent.click(screen.getByRole('button', { name: 'sign-out' }))

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('anonymous'))
    expect(order).toEqual(['stop', 'anonymous'])
  })

  it('ignores a restored session that becomes stale while its workspace is opening', async () => {
    localStorage.setItem('anonymous_migration_complete:user-1', 'complete')
    let resolveSwitch!: () => void
    const opening = new Promise<void>(resolve => { resolveSwitch = resolve })
    const authClient = createAuthClient(session())
    mocks.getClient.mockReturnValue(authClient as any)
    mocks.switchWorkspace.mockReturnValueOnce(opening).mockResolvedValue(undefined)

    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(mocks.switchWorkspace).toHaveBeenCalledWith({ kind: 'user', userId: 'user-1' }))
    act(() => authClient.emit('SIGNED_OUT', null))
    resolveSwitch()

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('anonymous'))
    expect(mocks.createEngine).not.toHaveBeenCalled()
  })

  it('stops an old engine whose start finishes after a newer account event', async () => {
    localStorage.setItem('anonymous_migration_complete:user-1', 'complete')
    localStorage.setItem('anonymous_migration_complete:user-2', 'complete')
    let resolveOldStart!: () => void
    const oldStart = new Promise<void>(resolve => { resolveOldStart = resolve })
    const authClient = createAuthClient(session('user-1'))
    const oldEngine = { start: vi.fn(() => oldStart), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    const newEngine = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), wake: vi.fn() }
    mocks.getClient.mockReturnValue(authClient as any)
    mocks.createEngine.mockReturnValueOnce(oldEngine).mockReturnValueOnce(newEngine)

    render(<AuthSyncProvider><Harness /></AuthSyncProvider>)
    await waitFor(() => expect(oldEngine.start).toHaveBeenCalledOnce())
    act(() => authClient.emit('SIGNED_IN', session('user-2', 'second@example.com')))
    resolveOldStart()

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('second@example.com'))
    expect(oldEngine.stop).toHaveBeenCalledOnce()
    expect(newEngine.start).toHaveBeenCalledOnce()
  })
})

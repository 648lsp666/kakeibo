import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CloudSyncCard } from './CloudSyncCard'

const mocks = vi.hoisted(() => ({
  auth: null as any,
  status: { kind: 'local-only' } as any,
}))

vi.mock('../../sync/auth-session', () => ({ useAuthSync: () => mocks.auth }))
vi.mock('../../sync/sync-store', () => ({ useSyncStore: (selector: (state: any) => unknown) => selector({ status: mocks.status }) }))

function auth(overrides: Record<string, unknown> = {}) {
  return {
    session: null,
    loading: false,
    migrationRequired: false,
    pending: 0,
    sendOtp: vi.fn().mockResolvedValue(undefined),
    confirmMigration: vi.fn().mockResolvedValue(undefined),
    skipMigration: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
    ...overrides,
  }
}

describe('CloudSyncCard', () => {
  beforeEach(() => {
    mocks.auth = auth()
    mocks.status = { kind: 'local-only' }
  })

  it('sends an email magic link and explains foreground automatic sync', async () => {
    render(<CloudSyncCard />)

    expect(screen.getByText(/应用打开时自动同步/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('邮箱地址'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: '发送登录链接' }))

    expect(mocks.auth.sendOtp).toHaveBeenCalledWith('reader@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent('登录链接已发送')
  })

  it('shows the signed-in account, status, pending count, retry, and sign-out', async () => {
    mocks.auth = auth({
      session: { user: { id: 'user-1', email: 'reader@example.com' } },
      pending: 3,
    })
    mocks.status = { kind: 'offline', pending: 3 }
    render(<CloudSyncCard />)

    expect(screen.getByText('reader@example.com')).toBeInTheDocument()
    expect(screen.getByText('离线 · 3 项待同步')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '立即重试' }))
    expect(mocks.auth.retry).toHaveBeenCalledOnce()

    await userEvent.click(screen.getByRole('button', { name: '退出账号' }))
    expect(screen.getByRole('dialog', { name: '退出同步账号？' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '确认退出' }))
    await waitFor(() => expect(mocks.auth.signOut).toHaveBeenCalledOnce())
  })

  it('requires an explicit migration choice and connects both actions', async () => {
    mocks.auth = auth({
      session: { user: { id: 'user-1', email: 'reader@example.com' } },
      migrationRequired: true,
    })
    mocks.status = { kind: 'error', pending: 0, message: '迁移失败，可重试' }
    render(<CloudSyncCard />)

    const dialog = screen.getByRole('dialog', { name: '合并本地账本？' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('迁移失败，可重试')
    expect(screen.getByText(/JSON 备份/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '确认合并' }))
    await waitFor(() => expect(mocks.auth.confirmMigration).toHaveBeenCalledOnce())
  })

  it('surfaces recoverable OTP errors', async () => {
    mocks.auth = auth({ sendOtp: vi.fn().mockRejectedValue(new Error('发送失败')) })
    render(<CloudSyncCard />)
    await userEvent.type(screen.getByLabelText('邮箱地址'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: '发送登录链接' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('发送失败')
    expect(screen.getByRole('button', { name: '发送登录链接' })).toBeEnabled()
  })
})

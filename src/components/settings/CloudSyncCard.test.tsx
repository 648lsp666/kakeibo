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
    isolated: 0,
    sendOtp: vi.fn().mockResolvedValue(undefined),
    verifyOtp: vi.fn().mockResolvedValue(undefined),
    confirmMigration: vi.fn().mockResolvedValue(undefined),
    skipMigration: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    prepareSignOut: vi.fn().mockResolvedValue(0),
    retry: vi.fn(),
    retryIsolated: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('CloudSyncCard', () => {
  beforeEach(() => {
    mocks.auth = auth()
    mocks.status = { kind: 'local-only' }
  })

  it('sends and verifies an email code inside the app', async () => {
    render(<CloudSyncCard />)

    expect(screen.getByText(/应用打开时自动同步/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('邮箱地址'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    expect(mocks.auth.sendOtp).toHaveBeenCalledWith('reader@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent('验证码已发送')
    await userEvent.type(screen.getByLabelText('邮箱验证码'), '123456')
    await userEvent.click(screen.getByRole('button', { name: '验证并登录' }))
    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith('reader@example.com', '123456')
  })

  it('accepts the eight-digit OTP configured by Supabase', async () => {
    render(<CloudSyncCard />)
    await userEvent.type(screen.getByLabelText('邮箱地址'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))
    await userEvent.type(screen.getByLabelText('邮箱验证码'), '12345678')
    await userEvent.click(screen.getByRole('button', { name: '验证并登录' }))

    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith('reader@example.com', '12345678')
  })

  it('shows the signed-in account, status, pending count, retry, and sign-out', async () => {
    mocks.auth = auth({
      session: { user: { id: 'user-1', email: 'reader@example.com' } },
      pending: 3,
      prepareSignOut: vi.fn().mockResolvedValue(3),
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

  it('does not skip migration through Sheet close paths', async () => {
    mocks.auth = auth({
      session: { user: { id: 'user-1', email: 'reader@example.com' } },
      migrationRequired: true,
    })
    const user = userEvent.setup()
    render(<CloudSyncCard />)

    const close = screen.getByRole('button', { name: '关闭' })
    expect(close).toBeDisabled()
    await user.click(close)
    expect(mocks.auth.skipMigration).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '合并本地账本？' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(mocks.auth.skipMigration).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog', { name: '合并本地账本？' })
    await user.click(dialog.parentElement!)
    expect(mocks.auth.skipMigration).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '暂不合并' }))
    await waitFor(() => expect(mocks.auth.skipMigration).toHaveBeenCalledOnce())
  })

  it('uses the authoritative workspace pending count before sign-out', async () => {
    mocks.auth = auth({
      session: { user: { id: 'user-1', email: 'reader@example.com' } },
      pending: 0,
      prepareSignOut: vi.fn().mockResolvedValue(4),
    })
    render(<CloudSyncCard />)

    await userEvent.click(screen.getByRole('button', { name: '退出账号' }))

    expect(mocks.auth.prepareSignOut).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog', { name: '退出同步账号？' })).toHaveTextContent('仍有 4 项待同步')
    expect(mocks.auth.signOut).not.toHaveBeenCalled()
  })

  it('shows a stable fallback when the signed-in session has no email', () => {
    mocks.auth = auth({ session: { user: { id: 'user-1', email: null } } })

    render(<CloudSyncCard />)

    expect(screen.getByText('已登录账号')).toBeInTheDocument()
  })

  it('surfaces recoverable OTP errors', async () => {
    mocks.auth = auth({ sendOtp: vi.fn().mockRejectedValue(new Error('发送失败')) })
    render(<CloudSyncCard />)
    await userEvent.type(screen.getByLabelText('邮箱地址'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('发送失败')
    expect(screen.getByRole('button', { name: '发送验证码' })).toBeEnabled()
  })

  it('replaces opaque Supabase retry errors with an actionable email-service message', async () => {
    const retryableError = Object.assign(new Error('{}'), { name: 'AuthRetryableFetchError' })
    mocks.auth = auth({ sendOtp: vi.fn().mockRejectedValue(retryableError) })
    render(<CloudSyncCard />)
    await userEvent.type(screen.getByLabelText('邮箱地址'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('验证码邮件发送失败，请检查发件域名或 SMTP 配置后重试')
    expect(alert).not.toHaveTextContent('{}')
    expect(screen.getByRole('button', { name: '发送验证码' })).toBeEnabled()
  })

  it('keeps the code form available after an invalid verification code', async () => {
    mocks.auth = auth({ verifyOtp: vi.fn().mockRejectedValue(new Error('验证码无效或已过期')) })
    render(<CloudSyncCard />)
    await userEvent.type(screen.getByLabelText('邮箱地址'), 'reader@example.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))
    await userEvent.type(screen.getByLabelText('邮箱验证码'), '123456')
    await userEvent.click(screen.getByRole('button', { name: '验证并登录' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('验证码无效或已过期')
    expect(screen.getByLabelText('邮箱验证码')).toHaveValue('123456')
    expect(screen.getByRole('button', { name: '验证并登录' })).toBeEnabled()
  })

  it('shows isolated changes with their reason and retries just those changes', async () => {
    mocks.auth = auth({
      session: { user: { id: 'user-1', email: 'reader@example.com' } },
      isolated: 2,
      isolatedReason: '内容格式无效',
    })
    render(<CloudSyncCard />)

    expect(screen.getByText('2 项更改需要处理')).toBeInTheDocument()
    expect(screen.getByText('内容格式无效')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '重试这些项目' }))
    await waitFor(() => expect(mocks.auth.retryIsolated).toHaveBeenCalledOnce())
  })
})

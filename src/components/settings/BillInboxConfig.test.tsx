import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BillInboxConfig } from './BillInboxConfig'

const mocks = vi.hoisted(() => ({
  auth: { session: null } as any,
  getAddress: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  copy: vi.fn(),
}))

vi.mock('../../sync/auth-session', () => ({ useAuthSync: () => mocks.auth }))
vi.mock('../../sync/supabase-client', () => ({ getSupabaseClientIfConfigured: () => ({}) }))
vi.mock('../../bill-inbox/client', () => ({
  createBillInboxClient: () => ({
    getAddress: mocks.getAddress,
    enable: mocks.enable,
    disable: mocks.disable,
  }),
}))

describe('BillInboxConfig', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_INBOUND_EMAIL_DOMAIN', 'bills.example.com')
    mocks.auth = { session: null }
    mocks.getAddress.mockReset().mockResolvedValue(null)
    mocks.enable.mockReset().mockResolvedValue({
      alias: '0123456789abcdefabcd',
      address: '0123456789abcdefabcd@bills.example.com',
    })
    mocks.disable.mockReset().mockResolvedValue(undefined)
    mocks.copy.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } })
  })

  it('is available only to signed-in cloud accounts', () => {
    render(<BillInboxConfig />)
    expect(screen.queryByText('邮件自动收账')).not.toBeInTheDocument()
  })

  it('enables a random private address and explains forwarding', async () => {
    mocks.auth = { session: { user: { id: 'user-1' } } }
    const user = userEvent.setup()
    render(<BillInboxConfig />)

    await user.click(await screen.findByRole('button', { name: '开启邮件收取' }))
    expect(await screen.findByText('0123456789abcdefabcd@bills.example.com')).toBeInTheDocument()
    expect(screen.getByText(/设置自动转发/)).toBeInTheDocument()
  })

  it('copies, resets, and permanently disables an existing address', async () => {
    mocks.auth = { session: { user: { id: 'user-1' } } }
    mocks.getAddress.mockResolvedValue({
      alias: 'oldalias000000000000',
      address: 'oldalias000000000000@bills.example.com',
    })
    const user = userEvent.setup()
    render(<BillInboxConfig />)

    await user.click(await screen.findByRole('button', { name: '复制专属邮箱' }))
    expect(await screen.findByRole('status')).toHaveTextContent('专属邮箱已复制')

    await user.click(screen.getByRole('button', { name: '重新生成' }))
    await user.click(screen.getByRole('button', { name: '确认重新生成' }))
    await waitFor(() => expect(mocks.enable).toHaveBeenCalledWith(true))

    await user.click(screen.getByRole('button', { name: '关闭邮件收取' }))
    expect(screen.getByRole('dialog', { name: '关闭邮件收取？' })).toHaveTextContent('待处理账单')
    await user.click(screen.getByRole('button', { name: '确认关闭' }))
    await waitFor(() => expect(mocks.disable).toHaveBeenCalledOnce())
  })
})

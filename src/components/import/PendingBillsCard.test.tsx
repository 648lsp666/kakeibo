import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingBillsCard } from './PendingBillsCard'

const mocks = vi.hoisted(() => ({
  bills: [] as any[],
  refresh: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  complete: vi.fn(),
  parse: vi.fn(),
}))

vi.mock('../../bill-inbox/usePendingBills', () => ({
  usePendingBills: () => ({
    bills: mocks.bills,
    loading: false,
    error: '',
    refresh: mocks.refresh,
    download: mocks.download,
    remove: mocks.remove,
    complete: mocks.complete,
  }),
}))
vi.mock('../../lib/bill-archive', () => ({ parseEncryptedBillArchive: mocks.parse }))

const pending = (id: string, filename: string) => ({
  id,
  filename,
  contentType: 'application/zip',
  sizeBytes: 1024,
  storagePath: `user-1/${id}/${filename}`,
  status: 'pending' as const,
  failureReason: null,
  receivedAt: '2026-07-17T00:00:00.000Z',
  expiresAt: '2026-07-24T00:00:00.000Z',
})

describe('PendingBillsCard', () => {
  beforeEach(() => {
    mocks.bills = []
    mocks.refresh.mockReset().mockResolvedValue(undefined)
    mocks.download.mockReset().mockResolvedValue(new ArrayBuffer(8))
    mocks.remove.mockReset().mockResolvedValue(undefined)
    mocks.complete.mockReset().mockResolvedValue(undefined)
    mocks.parse.mockReset().mockResolvedValue({ source: 'wechat', transactions: [{ id: 'tx-1' }] })
  })

  it('is absent when there is no backlog', () => {
    render(<PendingBillsCard onParsed={vi.fn()} />)
    expect(screen.queryByText('待处理账单')).not.toBeInTheDocument()
  })

  it('expands the newest bill and keeps additional bills collapsed', () => {
    mocks.bills = [pending('bill-1', 'wechat.zip'), pending('bill-2', 'alipay.zip')]
    render(<PendingBillsCard onParsed={vi.fn()} />)

    expect(screen.getByText('待处理账单')).toBeInTheDocument()
    expect(screen.getByText('2 份')).toBeInTheDocument()
    expect(screen.getByLabelText('wechat.zip 解压密码')).toBeInTheDocument()
    expect(screen.queryByLabelText('alipay.zip 解压密码')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开 alipay.zip' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收起 wechat.zip' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '展开 alipay.zip' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('removes collapsed fields from accessibility and restores them on expand', async () => {
    mocks.bills = [pending('bill-1', 'wechat.zip')]
    const user = userEvent.setup()
    render(<PendingBillsCard onParsed={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '收起 wechat.zip' }))
    await waitFor(() => expect(screen.queryByLabelText('wechat.zip 解压密码')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '展开 wechat.zip' }))
    expect(screen.getByLabelText('wechat.zip 解压密码')).toBeInTheDocument()
  })

  it('decrypts in memory, clears the password, and returns parsed transactions', async () => {
    mocks.bills = [pending('bill-1', 'wechat.zip')]
    const onParsed = vi.fn()
    const user = userEvent.setup()
    render(<PendingBillsCard onParsed={onParsed} />)

    const password = screen.getByLabelText('wechat.zip 解压密码')
    await user.type(password, 'secret')
    await user.click(screen.getByRole('button', { name: '输入密码并识别' }))

    await waitFor(() => expect(mocks.parse).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'secret'))
    expect(onParsed).toHaveBeenCalledWith(
      { source: 'wechat', transactions: [{ id: 'tx-1' }] },
      expect.objectContaining({ id: 'bill-1' }),
      expect.any(Function),
    )
    expect(password).toHaveValue('')
  })

  it('allows immediate retry after a wrong password', async () => {
    mocks.bills = [pending('bill-1', 'wechat.zip')]
    mocks.parse.mockRejectedValueOnce(new Error('密码错误或账单文件损坏'))
    const user = userEvent.setup()
    render(<PendingBillsCard onParsed={vi.fn()} />)

    await user.type(screen.getByLabelText('wechat.zip 解压密码'), 'wrong')
    await user.click(screen.getByRole('button', { name: '输入密码并识别' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('密码错误或账单文件损坏')
    expect(screen.getByRole('button', { name: '输入密码并识别' })).toBeEnabled()
  })

  it('requires confirmation and then deletes permanently', async () => {
    mocks.bills = [pending('bill-1', 'wechat.zip')]
    const user = userEvent.setup()
    render(<PendingBillsCard onParsed={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '删除 wechat.zip' }))
    expect(screen.getByRole('dialog', { name: '永久删除这份账单？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '永久删除' }))
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('bill-1'))
  })
})

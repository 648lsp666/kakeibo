import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebDAVConfig } from './WebDAVConfig'

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  set: vi.fn(),
  uploadBackup: vi.fn(),
  downloadAndMerge: vi.fn(),
}))

vi.mock('../../lib/db', () => ({
  syncConfigOps: { getAll: mocks.getAll, set: mocks.set },
}))
vi.mock('../../lib/webdav', () => ({
  uploadBackup: mocks.uploadBackup,
  downloadAndMerge: mocks.downloadAndMerge,
}))

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('WebDAVConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAll.mockResolvedValue({ last_sync_at: '2026-07-15T08:00:00.000Z' })
    mocks.set.mockResolvedValue(undefined)
    mocks.uploadBackup.mockResolvedValue(undefined)
    mocks.downloadAndMerge.mockResolvedValue({ added: 0, updated: 0 })
  })

  it('presents WebDAV as manual disaster recovery outside automatic sync', async () => {
    render(<WebDAVConfig />)

    expect(screen.getByRole('heading', { name: '手动灾备' })).toBeInTheDocument()
    expect(screen.getByText(/不参与自动同步/)).toBeInTheDocument()
    expect(screen.getByText(/请先退出账号并在本机模式恢复/)).toBeInTheDocument()
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalledOnce())
  })

  it('keeps the global focus outline and uses the safe small-text token', async () => {
    render(<WebDAVConfig />)

    await screen.findByText(/上次同步：/)
    for (const name of ['服务器地址', '用户名', '密码']) {
      const input = screen.getByLabelText(name) as HTMLInputElement
      expect(input.style.outline).toBe('')
      expect(screen.getByText(name)).toHaveStyle({ color: 'var(--color-text-small)' })
    }
    expect(screen.getByText(/上次同步：/)).toHaveStyle({ color: 'var(--color-text-small)' })
  })

  it('disables every action while save is active and reenables them afterward', async () => {
    const pendingSave = deferred<void>()
    mocks.set.mockImplementationOnce(() => pendingSave.promise)
    render(<WebDAVConfig />)
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalledOnce())

    await userEvent.click(screen.getByRole('button', { name: '保存配置' }))

    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '上传备份' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下载恢复' })).toBeDisabled()

    pendingSave.resolve()
    await waitFor(() => expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled())
    expect(screen.getByRole('button', { name: '上传备份' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '下载恢复' })).toBeEnabled()
  })

  it('surfaces a save error and reenables every action', async () => {
    const pendingSave = deferred<void>()
    mocks.set.mockImplementationOnce(() => pendingSave.promise)
    render(<WebDAVConfig />)
    await waitFor(() => expect(mocks.getAll).toHaveBeenCalledOnce())

    await userEvent.click(screen.getByRole('button', { name: '保存配置' }))
    pendingSave.reject(new Error('无法保存配置'))

    expect(await screen.findByRole('alert')).toHaveTextContent('无法保存配置')
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '上传备份' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '下载恢复' })).toBeEnabled()
  })
})

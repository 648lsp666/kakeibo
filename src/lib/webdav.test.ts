import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadAndMerge } from './webdav'

const mocks = vi.hoisted(() => ({
  getWorkspaceSnapshot: vi.fn(),
  importAnonymousWebDavTransactions: vi.fn(),
  set: vi.fn(),
}))

vi.mock('../sync/local-db', () => ({
  getWorkspaceSnapshot: mocks.getWorkspaceSnapshot,
  importAnonymousWebDavTransactions: mocks.importAnonymousWebDavTransactions,
}))
vi.mock('./db', () => ({
  transactionOps: { getAll: vi.fn() },
  categoryOps: { list: vi.fn() },
  syncConfigOps: { set: mocks.set },
}))

const transaction = (id: string, updatedAt = '2026-07-16T00:00:00.000Z') => ({
  id, amount: 10, type: 'expense', categoryId: 'food', note: '', date: '2026-07-16',
  source: 'manual', createdAt: updatedAt, updatedAt,
})

describe('downloadAndMerge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getWorkspaceSnapshot.mockResolvedValue({ id: { kind: 'anonymous' } })
    mocks.importAnonymousWebDavTransactions.mockResolvedValue({ added: 1, updated: 0 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ transactions: [transaction('restored')] }) }))
  })

  it('refuses recovery in a signed-in workspace before downloading or writing', async () => {
    mocks.getWorkspaceSnapshot.mockResolvedValue({ id: { kind: 'user', userId: 'account-1' } })

    await expect(downloadAndMerge({ url: 'https://dav.example', username: 'reader', password: 'secret' }))
      .rejects.toThrow('请先退出账号并在本机模式恢复 WebDAV 备份')

    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.importAnonymousWebDavTransactions).not.toHaveBeenCalled()
    expect(mocks.set).not.toHaveBeenCalled()
  })

  it('restores an anonymous workspace through the local-only import path', async () => {
    const result = await downloadAndMerge({ url: 'https://dav.example', username: 'reader', password: 'secret' })

    expect(result).toEqual({ added: 1, updated: 0 })
    expect(mocks.importAnonymousWebDavTransactions).toHaveBeenCalledWith([transaction('restored')])
    expect(mocks.set).toHaveBeenCalledWith('last_sync_at', expect.any(String))
  })
})

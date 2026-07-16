import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadAndMerge } from './webdav'

const mocks = vi.hoisted(() => ({
  exportSnapshot: vi.fn(),
  importTransactions: vi.fn(),
  upsert: vi.fn(),
  set: vi.fn(),
}))

vi.mock('../sync/domain-repository', () => ({ domainRepository: mocks }))
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
    mocks.exportSnapshot.mockResolvedValue({ transactions: [], categories: [], budgets: [] })
    mocks.importTransactions.mockResolvedValue({ added: 1, skipped: 0 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ transactions: [transaction('restored')] }) }))
  })

  it('imports restored records through the domain repository so they enter the outbox', async () => {
    await downloadAndMerge({ url: 'https://dav.example', username: 'reader', password: 'secret' })

    expect(mocks.importTransactions).toHaveBeenCalledWith([transaction('restored')])
    expect(mocks.set).toHaveBeenCalledWith('last_sync_at', expect.any(String))
  })
})

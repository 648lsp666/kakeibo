import { describe, expect, it, vi } from 'vitest'
import { createBillInboxClient } from './client'

const row = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  filename: 'wechat.zip',
  content_type: 'application/zip',
  size_bytes: 1024,
  storage_path: 'user-1/bill-1/wechat.zip',
  status: 'pending',
  failure_reason: null,
  received_at: '2026-07-17T00:00:00.000Z',
  expires_at: '2026-07-24T00:00:00.000Z',
}

function mockClient() {
  const order = vi.fn().mockResolvedValue({ data: [row], error: null })
  const inFilter = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ in: inFilter }))
  const download = vi.fn().mockResolvedValue({ data: new Blob(['zip']), error: null })
  return {
    client: {
      from: vi.fn(() => ({ select })),
      rpc: vi.fn().mockResolvedValue({ data: '0123456789abcdefabcd', error: null }),
      storage: { from: vi.fn(() => ({ download })) },
      functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) },
    },
    download,
  }
}

describe('bill inbox client', () => {
  it('maps the authenticated pending queue and composes the private address', async () => {
    const { client } = mockClient()
    const inbox = createBillInboxClient(client as never, 'user-1', 'bills.example.com')

    await expect(inbox.enable(false)).resolves.toEqual({
      alias: '0123456789abcdefabcd',
      address: '0123456789abcdefabcd@bills.example.com',
    })
    await expect(inbox.list()).resolves.toEqual([{
      id: row.id,
      filename: 'wechat.zip',
      contentType: 'application/zip',
      sizeBytes: 1024,
      storagePath: 'user-1/bill-1/wechat.zip',
      status: 'pending',
      failureReason: null,
      receivedAt: row.received_at,
      expiresAt: row.expires_at,
    }])
    expect(client.rpc).toHaveBeenCalledWith('enable_bill_inbox', { p_reset: false })
  })

  it('downloads only an attachment inside the current user folder', async () => {
    const { client, download } = mockClient()
    const inbox = createBillInboxClient(client as never, 'user-1', 'bills.example.com')
    const pending = (await inbox.list())[0]

    await expect(inbox.download(pending)).resolves.toBeInstanceOf(ArrayBuffer)
    expect(download).toHaveBeenCalledWith('user-1/bill-1/wechat.zip')
    await expect(inbox.download({ ...pending, storagePath: 'user-2/stolen.zip' }))
      .rejects.toThrow('账单附件路径无效')
  })

  it('uses the authenticated management function for completion, deletion, and disable', async () => {
    const { client } = mockClient()
    const inbox = createBillInboxClient(client as never, 'user-1', 'bills.example.com')

    await inbox.complete(row.id, { source: 'wechat', statementPeriod: '2026-06', importedCount: 12 })
    await inbox.delete(row.id)
    await inbox.disable()

    expect(client.functions.invoke.mock.calls).toEqual([
      ['manage-pending-bill', { body: { action: 'complete', billId: row.id, source: 'wechat', statementPeriod: '2026-06', importedCount: 12 } }],
      ['manage-pending-bill', { body: { action: 'delete', billId: row.id } }],
      ['manage-pending-bill', { body: { action: 'disable' } }],
    ])
  })
})

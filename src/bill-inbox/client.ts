import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { BillCompletion, BillInboxAddress, PendingBill } from './types'

interface PendingBillRow {
  id: unknown
  filename: unknown
  content_type: unknown
  size_bytes: unknown
  storage_path: unknown
  status: unknown
  failure_reason: unknown
  received_at: unknown
  expires_at: unknown
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`云端${label}格式无效`)
  return value
}

function optionalString(value: unknown, label: string): string | null {
  if (value === null) return null
  return requiredString(value, label)
}

function mapPendingBill(row: PendingBillRow): PendingBill {
  if (row.status !== 'pending' && row.status !== 'failed') throw new Error('云端账单状态无效')
  if (row.size_bytes !== null && (!Number.isSafeInteger(row.size_bytes) || Number(row.size_bytes) < 0)) {
    throw new Error('云端账单大小无效')
  }
  return {
    id: requiredString(row.id, '账单 ID'),
    filename: requiredString(row.filename, '文件名'),
    contentType: optionalString(row.content_type, '文件类型'),
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    storagePath: optionalString(row.storage_path, '附件路径'),
    status: row.status,
    failureReason: optionalString(row.failure_reason, '失败原因'),
    receivedAt: requiredString(row.received_at, '接收时间'),
    expiresAt: requiredString(row.expires_at, '过期时间'),
  }
}

function normalizedDomain(domain: string): string {
  const value = domain.trim().toLowerCase().replace(/^@/, '')
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(value)) {
    throw new Error('邮件账单接收域名尚未配置')
  }
  return value
}

function throwIfError(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || '邮件账单操作失败')
}

export function createBillInboxClient(client: SupabaseClient, userId: string, domainInput: string) {
  const domain = normalizedDomain(domainInput)

  const manage = async (body: Record<string, unknown>) => {
    const { error } = await client.functions.invoke('manage-pending-bill', { body })
    throwIfError(error)
  }

  return {
    async getAddress(): Promise<BillInboxAddress | null> {
      const { data, error } = await client
        .from('bill_inboxes')
        .select('alias')
        .maybeSingle()
      throwIfError(error)
      if (!data) return null
      const alias = requiredString(data.alias, '邮箱别名')
      return { alias, address: `${alias}@${domain}` }
    },

    async enable(reset = false): Promise<BillInboxAddress> {
      const { data, error } = await client.rpc('enable_bill_inbox', { p_reset: reset })
      throwIfError(error)
      const alias = requiredString(data, '邮箱别名')
      return { alias, address: `${alias}@${domain}` }
    },

    async list(): Promise<PendingBill[]> {
      const { data, error } = await client
        .from('pending_bills')
        .select('id,filename,content_type,size_bytes,storage_path,status,failure_reason,received_at,expires_at')
        .in('status', ['pending', 'failed'])
        .order('received_at', { ascending: false })
      throwIfError(error)
      return (data ?? []).map(row => mapPendingBill(row as PendingBillRow))
    },

    async download(bill: PendingBill): Promise<ArrayBuffer> {
      const prefix = `${userId}/`
      if (bill.status !== 'pending' || !bill.storagePath?.startsWith(prefix)) {
        throw new Error('账单附件路径无效')
      }
      const { data, error } = await client.storage.from('bill-attachments').download(bill.storagePath)
      throwIfError(error)
      if (!data) throw new Error('账单附件下载失败')
      return data.arrayBuffer()
    },

    complete(billId: string, completion: BillCompletion): Promise<void> {
      return manage({ action: 'complete', billId, ...completion })
    },

    delete(billId: string): Promise<void> {
      return manage({ action: 'delete', billId })
    },

    disable(): Promise<void> {
      return manage({ action: 'disable' })
    },

    subscribe(onChange: () => void): () => void {
      const channel: RealtimeChannel = client
        .channel(`pending-bills:${userId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'pending_bills', filter: `user_id=eq.${userId}`,
        }, onChange)
        .subscribe()
      return () => { void client.removeChannel(channel) }
    },
  }
}

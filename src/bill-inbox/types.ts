import type { BillSource } from '../lib/bill-file'

export interface BillInboxAddress {
  alias: string
  address: string
}

export interface PendingBill {
  id: string
  filename: string
  contentType: string | null
  sizeBytes: number | null
  storagePath: string | null
  status: 'pending' | 'failed'
  failureReason: string | null
  receivedAt: string
  expiresAt: string
}

export interface BillCompletion {
  source: BillSource
  statementPeriod: string
  importedCount: number
}

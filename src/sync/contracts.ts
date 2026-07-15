import type { BudgetRule, Category, Transaction } from '../types'

export type EntityType = 'transaction' | 'category' | 'budget'
export type OperationKind = 'upsert' | 'delete'
export type SyncPayload = Transaction | Category | BudgetRule

export interface PendingOperation {
  operationId: string
  entityType: EntityType
  entityId: string
  operation: OperationKind
  payload: SyncPayload | null
  createdAt: string
  attemptCount: number
  nextAttemptAt: string
  state: 'pending' | 'isolated'
  lastError?: string
}

export interface CloudRecord {
  entityType: EntityType
  entityId: string
  record: SyncPayload | null
  updatedAt: string
  deletedAt: string | null
}

export type SyncStatus =
  | { kind: 'local-only' }
  | { kind: 'idle'; lastSyncedAt?: string }
  | { kind: 'syncing'; pending: number }
  | { kind: 'offline'; pending: number }
  | { kind: 'auth-required'; pending: number }
  | { kind: 'error'; pending: number; message: string }

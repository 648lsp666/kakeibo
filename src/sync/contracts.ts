import type { BudgetRule, Category, Transaction } from '../types'

export type EntityType = 'transaction' | 'category' | 'budget'
export type MutationOperation = 'upsert' | 'delete' | 'restore'
export type SyncPayload = Transaction | Category | BudgetRule

export interface OutboxMutation {
  mutationId: string
  userId: string
  deviceId: string
  entityType: EntityType
  entityId: string
  operation: MutationOperation
  baseRevision: number
  payload: SyncPayload | null
  createdAt: string
  attemptCount: number
  nextAttemptAt: string
  state: 'pending' | 'dead-letter'
  lastError?: string
}

export interface RemoteChange {
  sequence: number
  entityType: EntityType
  entityId: string
  operation: MutationOperation
  revision: number
  record: SyncPayload | null
  deletedAt: string | null
}

export interface RecoverableChange {
  sequence: number
  entityType: EntityType
  entityId: string
  reason: 'deleted' | 'overwritten'
  record: SyncPayload
  revision: number
  createdAt: string
  deviceId: string
}

export type SyncStatus =
  | { kind: 'local-only' }
  | { kind: 'idle'; lastSyncedAt?: string }
  | { kind: 'syncing'; pending: number }
  | { kind: 'offline'; pending: number }
  | { kind: 'auth-required'; pending: number }
  | { kind: 'error'; pending: number; message: string }

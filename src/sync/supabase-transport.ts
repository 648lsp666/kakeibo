import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CloudRecord,
  EntityType,
  OperationResult,
  PendingOperation,
  SyncPayload,
  SyncTransport,
} from './contracts'

export class SyncTransportError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate-limit' | 'transient' | 'protocol',
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SyncTransportError'
  }
}

const tableEntities = [
  ['transactions', 'transaction'],
  ['categories', 'category'],
  ['budgets', 'budget'],
] as const satisfies ReadonlyArray<readonly [string, EntityType]>

const resultStatuses = new Set<OperationResult['status']>([
  'applied',
  'deleted',
  'duplicate',
  'deduplicated',
  'rejected_deleted',
])

function protocol(message: string): SyncTransportError {
  return new SyncTransportError(`Invalid sync ${message}`, 'protocol')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw protocol(label)
  return value
}

function timestamp(value: unknown, label: string, nullable = false): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw protocol(label)
  return value
}

function payload(value: unknown, entityId: string, deletedAt: string | null): SyncPayload | null {
  if (value === null) {
    if (deletedAt === null) throw protocol('payload')
    return null
  }
  if (!isObject(value)) throw protocol('payload')
  if (value.id !== entityId) throw protocol('payload ID')
  return value as unknown as SyncPayload
}

function cloudRecord(row: unknown, entityType: EntityType): CloudRecord {
  if (!isObject(row)) throw protocol('response row')
  const entityId = requiredId(row.id, 'entity ID')
  const deletedAt = timestamp(row.deleted_at, 'deleted timestamp', true)
  return {
    entityType,
    entityId,
    record: payload(row.payload, entityId, deletedAt),
    updatedAt: timestamp(row.updated_at, 'updated timestamp') as string,
    deletedAt,
  }
}

function statusFrom(error: unknown): number | undefined {
  if (!isObject(error)) return undefined
  const value = error.status
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function transportError(error: unknown, responseStatus?: number): SyncTransportError {
  if (error instanceof SyncTransportError) return error
  const status = responseStatus ?? statusFrom(error)
  const message = error instanceof Error
    ? error.message
    : isObject(error) && typeof error.message === 'string'
      ? error.message
      : 'Sync request failed'
  if (status === 401 || status === 403) return new SyncTransportError(message, 'auth', status)
  if (status === 429) return new SyncTransportError(message, 'rate-limit', status)
  if (status !== undefined && status >= 500) return new SyncTransportError(message, 'transient', status)
  if (error instanceof TypeError || status === undefined) return new SyncTransportError(message, 'transient', status)
  return new SyncTransportError(message, 'protocol', status)
}

function operationResult(value: unknown, operation: PendingOperation): OperationResult {
  if (!isObject(value)) throw protocol('response')
  const operationId = requiredId(value.operation_id, 'operation ID')
  if (operationId !== operation.operationId) throw protocol('operation ID')
  if (!resultStatuses.has(value.status as OperationResult['status'])) throw protocol('status')
  if (value.entity_type !== 'transaction' && value.entity_type !== 'category' && value.entity_type !== 'budget') {
    throw protocol('entity type')
  }
  const entityId = requiredId(value.entity_id, 'entity ID')
  const deletedAt = timestamp(value.deleted_at, 'deleted timestamp', true)
  return {
    operationId,
    status: value.status as OperationResult['status'],
    entityType: value.entity_type,
    entityId,
    record: payload(value.record, entityId, deletedAt),
    updatedAt: timestamp(value.updated_at, 'updated timestamp') as string,
    deletedAt,
  }
}

export function createSupabaseTransport(client: SupabaseClient, userId: string): SyncTransport {
  return {
    async pullAll() {
      const requests = tableEntities.map(async ([table, entityType]) => {
        try {
          const response = await client.from(table).select('id,payload,updated_at,deleted_at')
          if (response.error) throw transportError(response.error, response.status)
          if (!Array.isArray(response.data)) throw protocol('pull response')
          return response.data.map(row => cloudRecord(row, entityType))
        } catch (error) {
          throw transportError(error)
        }
      })
      return (await Promise.all(requests)).flat()
    },

    async push(operation) {
      try {
        const response = await client.rpc('apply_operation', {
          p_operation_id: operation.operationId,
          p_entity_type: operation.entityType,
          p_entity_id: operation.entityId,
          p_operation: operation.operation,
          p_payload: operation.payload,
        })
        if (response.error) throw transportError(response.error, response.status)
        return operationResult(response.data, operation)
      } catch (error) {
        throw transportError(error)
      }
    },

    async subscribe(onWake, onConnection) {
      const channel = client.channel(`sync:${userId}`)
      for (const [table] of tableEntities) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
          () => onWake(),
        )
      }
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') onConnection(true)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onConnection(false)
      })
      return async () => {
        await client.removeChannel(channel)
      }
    },
  }
}

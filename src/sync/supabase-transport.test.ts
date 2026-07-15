import { describe, expect, it, vi } from 'vitest'
import type { PendingOperation } from './contracts'
import { createSupabaseTransport, SyncTransportError } from './supabase-transport'

const operation: PendingOperation = {
  operationId: 'op-1',
  entityType: 'transaction',
  entityId: 'tx-1',
  operation: 'upsert',
  payload: { id: 'tx-1', amount: 12, type: 'expense', categoryId: 'food', note: '', date: '2026-07-15', source: 'manual', createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z' },
  createdAt: '2026-07-15T00:00:00.000Z',
  attemptCount: 0,
  nextAttemptAt: '2026-07-15T00:00:00.000Z',
  state: 'pending',
}

function clientWithRows(
  overrides: Record<string, unknown> = {},
  rowOverrides: Record<string, unknown[]> = {},
) {
  const rows: Record<string, unknown[]> = {
    transactions: [{ id: 'tx-1', payload: operation.payload, updated_at: '2026-07-15T01:00:00.000Z', deleted_at: null }],
    categories: [{ id: 'cat-1', payload: null, updated_at: '2026-07-15T02:00:00.000Z', deleted_at: '2026-07-15T02:00:00.000Z' }],
    budgets: [{ id: 'budget-1', payload: { id: 'budget-1', amount: 300, period: 'monthly' }, updated_at: '2026-07-15T03:00:00.000Z', deleted_at: null }],
    ...rowOverrides,
  }
  return {
    from: vi.fn((table: string) => ({ select: vi.fn().mockResolvedValue({ data: rows[table], error: null }) })),
    rpc: vi.fn().mockResolvedValue({
      data: { operation_id: 'op-1', status: 'applied', entity_type: 'transaction', entity_id: 'tx-1', record: operation.payload, updated_at: '2026-07-15T04:00:00.000Z', deleted_at: null },
      error: null,
    }),
    ...overrides,
  }
}

describe('Supabase sync transport', () => {
  it('pulls all three tables and maps snake_case rows including tombstones', async () => {
    const client = clientWithRows()

    await expect(createSupabaseTransport(client as never, 'user-1').pullAll()).resolves.toEqual([
      { entityType: 'transaction', entityId: 'tx-1', record: operation.payload, updatedAt: '2026-07-15T01:00:00.000Z', deletedAt: null },
      { entityType: 'category', entityId: 'cat-1', record: null, updatedAt: '2026-07-15T02:00:00.000Z', deletedAt: '2026-07-15T02:00:00.000Z' },
      { entityType: 'budget', entityId: 'budget-1', record: { id: 'budget-1', amount: 300, period: 'monthly' }, updatedAt: '2026-07-15T03:00:00.000Z', deletedAt: null },
    ])
    expect(client.from.mock.calls.map(([table]) => table)).toEqual(['transactions', 'categories', 'budgets'])
  })

  it('sends the exact RPC arguments and validates/maps its result', async () => {
    const client = clientWithRows()

    await expect(createSupabaseTransport(client as never, 'user-1').push(operation)).resolves.toEqual({
      operationId: 'op-1', status: 'applied', entityType: 'transaction', entityId: 'tx-1', record: operation.payload,
      updatedAt: '2026-07-15T04:00:00.000Z', deletedAt: null,
    })
    expect(client.rpc).toHaveBeenCalledWith('apply_operation', {
      p_operation_id: 'op-1', p_entity_type: 'transaction', p_entity_id: 'tx-1', p_operation: 'upsert', p_payload: operation.payload,
    })
  })

  it.each([
    [{ id: '', payload: {}, updated_at: '2026-07-15T01:00:00.000Z', deleted_at: null }, 'entity ID'],
    [{ id: 'tx-1', payload: [], updated_at: '2026-07-15T01:00:00.000Z', deleted_at: null }, 'payload'],
    [{ id: 'tx-1', payload: { id: 'other' }, updated_at: '2026-07-15T01:00:00.000Z', deleted_at: null }, 'payload ID'],
    [{ id: 'tx-1', payload: operation.payload, updated_at: 'not-a-date', deleted_at: null }, 'timestamp'],
  ])('rejects malformed pulled rows (%s)', async (row, message) => {
    const client = clientWithRows({ from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [row], error: null }) })) })
    await expect(createSupabaseTransport(client as never, 'user-1').pullAll()).rejects.toMatchObject({ kind: 'protocol', message: expect.stringContaining(message) })
  })

  it.each([
    ['transactions', 'transaction', { ...(operation.payload as object), id: 'tx-1', note: undefined }],
    ['categories', 'category', { id: 'cat-invalid', name: 'bad', type: 'expense', isSystem: false, sortOrder: '1', createdAt: '2026-07-15T00:00:00.000Z' }],
    ['budgets', 'budget', { id: 'budget-invalid', amount: 100, period: 'weekly' }],
  ])('rejects invalid %s payload shapes from pull', async (table, _entityType, invalidPayload) => {
    const id = String(invalidPayload.id)
    const client = clientWithRows({}, {
      [table]: [{ id, payload: invalidPayload, updated_at: '2026-07-15T01:00:00.000Z', deleted_at: null }],
    })
    await expect(createSupabaseTransport(client as never, 'user-1').pullAll()).rejects.toMatchObject({ kind: 'protocol' })
  })

  it('rejects transaction dates outside YYYY-MM-DD', async () => {
    const invalidPayload = { ...(operation.payload as object), date: '07/15/2026' }
    const client = clientWithRows({}, {
      transactions: [{ id: 'tx-1', payload: invalidPayload, updated_at: '2026-07-15T01:00:00.000Z', deleted_at: null }],
    })
    await expect(createSupabaseTransport(client as never, 'user-1').pullAll()).rejects.toMatchObject({ kind: 'protocol' })
  })

  it.each([
    ['transaction', { ...(operation.payload as object), id: 'tx-1', amount: '12' }],
    ['category', { id: 'cat-push', name: 'bad', type: 'expense', isSystem: 'false', sortOrder: 1, createdAt: '2026-07-15T00:00:00.000Z' }],
    ['budget', { id: 'budget-push', amount: null, period: 'monthly' }],
  ] as const)('rejects invalid %s payload shapes from push results', async (entityType, invalidPayload) => {
    const pendingOperation: PendingOperation = {
      ...operation,
      entityType,
      entityId: String(invalidPayload.id),
      payload: invalidPayload as never,
    }
    const client = clientWithRows({ rpc: vi.fn().mockResolvedValue({
      data: {
        operation_id: 'op-1', status: 'applied', entity_type: entityType,
        entity_id: invalidPayload.id, record: invalidPayload,
        updated_at: '2026-07-15T04:00:00.000Z', deleted_at: null,
      },
      error: null,
    }) })
    await expect(createSupabaseTransport(client as never, 'user-1').push(pendingOperation)).rejects.toMatchObject({ kind: 'protocol' })
  })

  it('rejects a push result whose entity type differs from the requested operation', async () => {
    const client = clientWithRows({ rpc: vi.fn().mockResolvedValue({
      data: {
        operation_id: 'op-1', status: 'applied', entity_type: 'budget', entity_id: 'tx-1',
        record: { id: 'tx-1', amount: 100, period: 'monthly' },
        updated_at: '2026-07-15T04:00:00.000Z', deleted_at: null,
      },
      error: null,
    }) })
    await expect(createSupabaseTransport(client as never, 'user-1').push(operation)).rejects.toMatchObject({ kind: 'protocol' })
  })

  it('rejects category icon values outside the IconName enum', async () => {
    const invalidPayload = {
      id: 'cat-invalid-icon', name: 'bad icon', icon: 'not-an-icon', type: 'expense',
      isSystem: false, sortOrder: 1, createdAt: '2026-07-15T00:00:00.000Z',
    }
    const client = clientWithRows({}, {
      categories: [{ id: invalidPayload.id, payload: invalidPayload, updated_at: '2026-07-15T01:00:00.000Z', deleted_at: null }],
    })
    await expect(createSupabaseTransport(client as never, 'user-1').pullAll()).rejects.toMatchObject({ kind: 'protocol' })
  })

  it.each([
    [null, 'response'],
    [{ operation_id: 'op-1', status: 'invalid', entity_type: 'transaction', entity_id: 'tx-1', record: null, updated_at: null, deleted_at: null }, 'status'],
    [{ operation_id: 'wrong', status: 'applied', entity_type: 'transaction', entity_id: 'tx-1', record: operation.payload, updated_at: '2026-07-15T04:00:00.000Z', deleted_at: null }, 'operation ID'],
  ])('rejects malformed RPC results', async (data, message) => {
    const client = clientWithRows({ rpc: vi.fn().mockResolvedValue({ data, error: null }) })
    await expect(createSupabaseTransport(client as never, 'user-1').push(operation)).rejects.toMatchObject({ kind: 'protocol', message: expect.stringContaining(message) })
  })

  it.each([
    [401, 'auth'], [403, 'auth'], [429, 'rate-limit'], [500, 'transient'], [503, 'transient'], [400, 'protocol'],
  ])('classifies HTTP %s errors as %s', async (status, kind) => {
    const client = clientWithRows({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'failed' }, status }) })
    await expect(createSupabaseTransport(client as never, 'user-1').push(operation)).rejects.toMatchObject({ kind, status })
  })

  it('classifies thrown network failures as transient', async () => {
    const client = clientWithRows({ rpc: vi.fn().mockRejectedValue(new TypeError('fetch failed')) })
    await expect(createSupabaseTransport(client as never, 'user-1').push(operation)).rejects.toBeInstanceOf(SyncTransportError)
    await expect(createSupabaseTransport(client as never, 'user-1').push(operation)).rejects.toMatchObject({ kind: 'transient' })
  })

  it('subscribes to user-filtered wake-only changes and cleans up the channel', async () => {
    const handlers: Array<(payload: unknown) => void> = []
    let statusHandler: ((status: string) => void) | undefined
    const channel = {
      on: vi.fn((_event: string, _config: unknown, handler: (payload: unknown) => void) => { handlers.push(handler); return channel }),
      subscribe: vi.fn((handler: (status: string) => void) => { statusHandler = handler; return channel }),
    }
    const removeChannel = vi.fn().mockResolvedValue('ok')
    const client = clientWithRows({ channel: vi.fn(() => channel), removeChannel })
    const wakes = vi.fn()
    const connections = vi.fn()

    const unsubscribe = await createSupabaseTransport(client as never, 'user-1').subscribe(wakes, connections)
    expect(channel.on).toHaveBeenCalledTimes(3)
    expect(channel.on.mock.calls.map(([, config]) => config)).toEqual([
      expect.objectContaining({ table: 'transactions', filter: 'user_id=eq.user-1' }),
      expect.objectContaining({ table: 'categories', filter: 'user_id=eq.user-1' }),
      expect.objectContaining({ table: 'budgets', filter: 'user_id=eq.user-1' }),
    ])
    handlers[0]({ new: { payload: { hostile: true } } })
    expect(wakes).toHaveBeenCalledOnce()
    statusHandler?.('SUBSCRIBED')
    statusHandler?.('CHANNEL_ERROR')
    expect(connections.mock.calls).toEqual([[true], [false]])

    await unsubscribe()
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })

  it.each(['on', 'subscribe'] as const)('removes the channel when Realtime %s setup throws', async failurePoint => {
    const channel = {
      on: vi.fn(),
      subscribe: vi.fn(),
    }
    channel.on.mockImplementation(() => {
      if (failurePoint === 'on') throw new Error('on setup failed')
      return channel
    })
    channel.subscribe.mockImplementation(() => {
      if (failurePoint === 'subscribe') throw new Error('subscribe setup failed')
      return channel
    })
    const removeChannel = vi.fn().mockResolvedValue('ok')
    const client = clientWithRows({ channel: vi.fn(() => channel), removeChannel })

    await expect(createSupabaseTransport(client as never, 'user-1').subscribe(vi.fn(), vi.fn())).rejects.toThrow('setup failed')
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
})

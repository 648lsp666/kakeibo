import { afterEach, describe, expect, it } from 'vitest'
import { createSimpleSyncHarness } from '../test/simple-sync-harness'

describe('simple two-device synchronization', () => {
  let harness: ReturnType<typeof createSimpleSyncHarness> | undefined

  afterEach(async () => {
    await harness?.close()
  })

  it('keeps an offline write local until transport recovery wakes device A and both devices converge', async () => {
    harness = createSimpleSyncHarness()
    const syncHarness = harness
    const a = await syncHarness.device('a')
    const b = await syncHarness.device('b')

    await a.goOffline()
    await a.addTransaction('a-offline')
    expect(syncHarness.serverWriteCount('a-offline')).toBe(0)
    await expect(a.pendingOperationCount()).resolves.toBe(1)

    await b.addTransaction('b-online')
    await syncHarness.waitFor(() => syncHarness.serverWriteCount('b-online') === 1)
    await a.goOnline()
    await syncHarness.waitFor(() => a.connectionNotificationCount() === 1)
    await syncHarness.waitFor(() => syncHarness.serverWriteCount('a-offline') === 1)
    await a.waitForIdle()
    await b.waitForIdle()

    await expect(a.transactionIds()).resolves.toEqual(['a-offline', 'b-online'])
    await expect(b.transactionIds()).resolves.toEqual(['a-offline', 'b-online'])
  })

  it('shows the category operation accepted last by the server on both devices', async () => {
    harness = createSimpleSyncHarness()
    const a = await harness.device('a')
    const b = await harness.device('b')

    await a.upsertCategory('food', 'A food')
    await b.upsertCategory('food', 'B food')
    await a.sync()
    await b.sync()
    await a.sync()

    await expect(a.categoryName('food')).resolves.toBe('B food')
    await expect(b.categoryName('food')).resolves.toBe('B food')
  })

  it('rejects B stale upsert after A deletes a transaction and removes it from both devices', async () => {
    harness = createSimpleSyncHarness()
    const a = await harness.device('a')
    const b = await harness.device('b')

    await a.addTransaction('deleted')
    await a.sync()
    await b.sync()
    await b.updateTransaction('deleted', 'stale update')
    await a.deleteTransaction('deleted')
    await a.sync()
    await b.sync()
    await a.sync()

    await expect(a.transactionIds()).resolves.toEqual([])
    await expect(b.transactionIds()).resolves.toEqual([])
  })

  it('applies a lost operation response only once when it is retried', async () => {
    harness = createSimpleSyncHarness()
    const a = await harness.device('a')

    await a.addTransaction('once')
    harness.loseNextResponse()
    await a.sync()
    await a.sync()

    expect(harness.serverWriteCount('once')).toBe(1)
    await expect(a.transactionIds()).resolves.toEqual(['once'])
  })

  it('does not write a delayed user-one pull into user two after account switch', async () => {
    harness = createSimpleSyncHarness()
    const a = await harness.device('a', 'user-one')
    await a.addTransaction('user-one-row')
    await a.sync()

    const delayed = a.sync({ delayPull: true })
    await harness.waitForDelayedPull()
    await a.switchUser('user-two')
    harness.resolveDelayedPull()
    await delayed

    await expect(a.transactionIds()).resolves.toEqual([])
  })

  it('stops closed devices from reacting to online and local wake signals', async () => {
    harness = createSimpleSyncHarness()
    const a = await harness.device('a')
    const b = await harness.device('b')

    const aRequestsBeforeClose = a.syncRequestCount()
    await a.close()
    expect(harness.activeSubscriberCount()).toBe(1)
    await a.goOnline()
    await b.addTransaction('after-close')
    await harness.waitForIdle()

    expect(harness.serverWriteCount('after-close')).toBe(1)
    expect(a.connectionNotificationCount()).toBe(0)
    expect(a.syncRequestCount()).toBe(aRequestsBeforeClose)

    await harness.close()
    expect(harness.activeSubscriberCount()).toBe(0)
  })
})

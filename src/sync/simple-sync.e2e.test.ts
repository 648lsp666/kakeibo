import { describe, expect, it } from 'vitest'
import { createSimpleSyncHarness } from '../test/simple-sync-harness'

describe('simple two-device synchronization', () => {
  it('converges an offline device A and an online device B after A reconnects', async () => {
    const harness = createSimpleSyncHarness()
    const a = await harness.device('a')
    const b = await harness.device('b')

    await a.offlineAddTransaction('a-offline')
    await b.addTransaction('b-online')
    await b.sync()
    await a.sync()
    await b.sync()

    await expect(a.transactionIds()).resolves.toEqual(['a-offline', 'b-online'])
    await expect(b.transactionIds()).resolves.toEqual(['a-offline', 'b-online'])
  })

  it('shows the category operation accepted last by the server on both devices', async () => {
    const harness = createSimpleSyncHarness()
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
    const harness = createSimpleSyncHarness()
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
    const harness = createSimpleSyncHarness()
    const a = await harness.device('a')

    await a.addTransaction('once')
    harness.loseNextResponse()
    await a.sync()
    await a.sync()

    expect(harness.serverWriteCount('once')).toBe(1)
    await expect(a.transactionIds()).resolves.toEqual(['once'])
  })

  it('does not write a delayed user-one pull into user two after account switch', async () => {
    const harness = createSimpleSyncHarness()
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
})

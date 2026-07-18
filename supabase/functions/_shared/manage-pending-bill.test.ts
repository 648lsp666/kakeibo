import { describe, expect, it } from 'vitest'
import { parseManagePendingBillAction } from './manage-pending-bill'

describe('pending bill management validation', () => {
  it('validates completion metadata', () => {
    expect(parseManagePendingBillAction({
      action: 'complete',
      billId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      source: 'wechat',
      statementPeriod: '2026-06',
      importedCount: 12,
    })).toEqual({
      action: 'complete',
      billId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      source: 'wechat',
      statementPeriod: '2026-06',
      importedCount: 12,
    })
  })

  it('accepts delete and disable actions with their minimal shape', () => {
    expect(parseManagePendingBillAction({ action: 'delete', billId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }))
      .toEqual({ action: 'delete', billId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
    expect(parseManagePendingBillAction({ action: 'disable' })).toEqual({ action: 'disable' })
  })

  it.each([
    { action: 'complete', billId: 'bad', source: 'wechat', statementPeriod: '2026-06', importedCount: 1 },
    { action: 'complete', billId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', source: 'bank', statementPeriod: '2026-06', importedCount: 1 },
    { action: 'complete', billId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', source: 'wechat', statementPeriod: 'June', importedCount: 1 },
    { action: 'complete', billId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', source: 'wechat', statementPeriod: '2026-06', importedCount: -1 },
    { action: 'unknown' },
  ])('rejects malformed management payloads', payload => {
    expect(() => parseManagePendingBillAction(payload)).toThrow('请求参数无效')
  })
})

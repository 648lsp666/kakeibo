export type ManagePendingBillAction =
  | { action: 'delete'; billId: string }
  | { action: 'disable' }
  | {
    action: 'complete'
    billId: string
    source: 'wechat' | 'alipay'
    statementPeriod: string
    importedCount: number
  }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseManagePendingBillAction(input: unknown): ManagePendingBillAction {
  if (!input || typeof input !== 'object') throw new Error('请求参数无效')
  const value = input as Record<string, unknown>
  if (value.action === 'disable') return { action: 'disable' }
  if (value.action === 'delete' && typeof value.billId === 'string' && UUID.test(value.billId)) {
    return { action: 'delete', billId: value.billId }
  }
  if (value.action === 'complete'
    && typeof value.billId === 'string' && UUID.test(value.billId)
    && (value.source === 'wechat' || value.source === 'alipay')
    && typeof value.statementPeriod === 'string' && /^\d{4}-\d{2}$/.test(value.statementPeriod)
    && Number.isSafeInteger(value.importedCount) && Number(value.importedCount) >= 0
  ) {
    return {
      action: 'complete',
      billId: value.billId,
      source: value.source,
      statementPeriod: value.statementPeriod,
      importedCount: Number(value.importedCount),
    }
  }
  throw new Error('请求参数无效')
}

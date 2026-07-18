import { nanoid } from 'nanoid'
import { guessCategory } from './auto-category'
import type { Transaction } from '../types'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}

function indexByHeader(headers: string[], names: string[]): number {
  return headers.findIndex(header => names.some(name => header.includes(name)))
}

function parseAmount(value: string | undefined): number {
  const normalized = String(value ?? '')
    .replace(/[¥￥,+元\s]/g, '')
    .replace(/[()（）]/g, '')
  const amount = Math.round(parseFloat(normalized) * 100) / 100
  return Number.isFinite(amount) ? amount : 0
}

export function parseAlipayCSV(content: string): Transaction[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const headerIdx = lines.findIndex(l => l.startsWith('交易时间'))
  if (headerIdx === -1) throw new Error('未找到支付宝账单标题行，请检查文件格式')

  const headers = parseCSVLine(lines[headerIdx])
  const dateIdx = indexByHeader(headers, ['交易时间'])
  const categoryIdx = indexByHeader(headers, ['交易分类'])
  const counterpartyIdx = indexByHeader(headers, ['交易对方'])
  const goodsIdx = indexByHeader(headers, ['商品说明', '商品名称'])
  const directionIdx = indexByHeader(headers, ['收/支', '收支'])
  const amountIdx = indexByHeader(headers, ['金额'])
  const incomeAmountIdx = indexByHeader(headers, ['收入金额'])
  const expenseAmountIdx = indexByHeader(headers, ['支出金额'])
  const statusIdx = indexByHeader(headers, ['交易状态', '当前状态'])
  const txNoIdx = indexByHeader(headers, ['交易订单号', '支付宝交易号'])
  const dataLines = lines.slice(headerIdx + 1)
  const now = new Date().toISOString()
  const results: Transaction[] = []

  for (const line of dataLines) {
    const cols = parseCSVLine(line)
    if (cols.length < 2) continue

    const status = statusIdx >= 0 ? cols[statusIdx] : ''
    if (status === '交易关闭') continue

    let direction = directionIdx >= 0 ? cols[directionIdx] : ''
    let amount = amountIdx >= 0 ? parseAmount(cols[amountIdx]) : 0
    const incomeAmount = incomeAmountIdx >= 0 ? parseAmount(cols[incomeAmountIdx]) : 0
    const expenseAmount = expenseAmountIdx >= 0 ? parseAmount(cols[expenseAmountIdx]) : 0

    if (!direction && (incomeAmount > 0 || expenseAmount > 0)) {
      direction = incomeAmount > 0 ? '收入' : '支出'
      amount = incomeAmount > 0 ? incomeAmount : expenseAmount
    }
    if (!['收入', '支出'].includes(direction)) continue
    if (amount <= 0) continue

    const dateTime = dateIdx >= 0 ? cols[dateIdx] : cols[0]
    const date = dateTime.slice(0, 10)
    const type = direction === '收入' ? 'income' : 'expense'
    const counterparty = counterpartyIdx >= 0 ? cols[counterpartyIdx] : ''
    const goods = goodsIdx >= 0 ? cols[goodsIdx] : ''
    const merchant = counterparty || goods
    const transactionCategory = categoryIdx >= 0 ? cols[categoryIdx] : ''
    const categoryId = guessCategory(merchant, type, `${transactionCategory} ${goods}`)
    const txNo = txNoIdx >= 0 ? cols[txNoIdx] : ''

    results.push({
      id: nanoid(),
      amount,
      type,
      categoryId,
      note: (goods || counterparty) || '',
      date,
      source: 'alipay',
      externalId: txNo.trim().replace(/^[=\t'"]+/, ''),
      createdAt: now,
      updatedAt: now,
    })
  }
  return results
}

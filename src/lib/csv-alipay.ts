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

export function parseAlipayCSV(content: string): Transaction[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const headerIdx = lines.findIndex(l => l.startsWith('交易时间'))
  if (headerIdx === -1) throw new Error('未找到支付宝账单标题行，请检查文件格式')

  const dataLines = lines.slice(headerIdx + 1)
  const now = new Date().toISOString()
  const results: Transaction[] = []

  for (const line of dataLines) {
    const cols = parseCSVLine(line)
    if (cols.length < 10) continue

    const [dateTime, , counterparty, , goods, direction, amountStr, , status, txNo] = cols
    if (status === '交易关闭') continue
    if (!['收入', '支出'].includes(direction)) continue

    const amount = Math.round(parseFloat(amountStr.replace(',', '')) * 100) / 100
    if (isNaN(amount) || amount <= 0) continue

    const date = dateTime.slice(0, 10)
    const type = direction === '收入' ? 'income' : 'expense'
    const merchant = counterparty || goods
    const categoryId = guessCategory(merchant)

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

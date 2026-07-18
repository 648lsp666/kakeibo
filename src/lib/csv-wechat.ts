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

function buildTransaction(cols: string[]): Transaction | null {
  const [dateTime, transactionKind, counterparty, goods, direction, amountStr, , , txNo] = cols
  if (!dateTime || !['收入', '支出'].includes(direction)) return null

  const amount = Math.round(parseFloat(String(amountStr).replace('¥', '').replace(',', '')) * 100) / 100
  if (isNaN(amount) || amount <= 0) return null

  const date = dateTime.slice(0, 10)
  const type = direction === '收入' ? 'income' : 'expense'
  const merchant = counterparty || goods
  const now = new Date().toISOString()

  return {
    id: nanoid(),
    amount,
    type,
    categoryId: guessCategory(merchant, type, `${transactionKind} ${goods}`),
    note: (goods !== '/' ? goods : counterparty) || '',
    date,
    source: 'wechat',
    externalId: String(txNo || '').trim().replace(/^[=\t'"]+/, ''),
    createdAt: now,
    updatedAt: now,
  }
}

export function parseWechatCSV(content: string): Transaction[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const headerIdx = lines.findIndex(l => l.startsWith('交易时间'))
  if (headerIdx === -1) throw new Error('未找到微信账单标题行，请检查文件格式')

  const results: Transaction[] = []
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = parseCSVLine(line)
    if (cols.length < 9) continue
    const tx = buildTransaction(cols)
    if (tx) results.push(tx)
  }
  return results
}

export async function parseWechatXLSX(buffer: ArrayBuffer): Promise<Transaction[]> {
  const { read, utils } = await import('xlsx')
  const workbook = read(buffer, { type: 'array', cellText: true, cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' }) as string[][]

  const headerIdx = rows.findIndex(row => String(row[0]).startsWith('交易时间'))
  if (headerIdx === -1) throw new Error('未找到微信账单标题行，请检查文件格式')

  const results: Transaction[] = []
  for (const cols of rows.slice(headerIdx + 1)) {
    if (cols.length < 9) continue
    const tx = buildTransaction(cols.map(String))
    if (tx) results.push(tx)
  }
  return results
}

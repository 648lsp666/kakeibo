import type { Transaction } from '../types'
import { parseAlipayCSV } from './csv-alipay'
import { parseWechatCSV, parseWechatXLSX } from './csv-wechat'

export type BillSource = 'wechat' | 'alipay'

export interface ParsedBillFile {
  source: BillSource
  transactions: Transaction[]
}

function asUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
}

async function readCSVWithEncodingFallback(bytes: Uint8Array): Promise<string> {
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (utf8.includes('交易时间')) return utf8
  return new TextDecoder('gbk').decode(bytes)
}

function detectSource(content: string): BillSource | null {
  if (content.includes('微信支付账单') || content.includes('微信支付')) return 'wechat'
  if (content.includes('支付宝交易记录') || content.includes('支付宝')) return 'alipay'
  return null
}

export async function parseBillFile(
  filename: string,
  input: ArrayBuffer | Uint8Array,
): Promise<ParsedBillFile> {
  const bytes = asUint8Array(input)
  const extension = filename.split('.').pop()?.toLowerCase()
  if (extension === 'xlsx' || extension === 'xls') {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return { source: 'wechat', transactions: await parseWechatXLSX(buffer) }
  }
  if (extension !== 'csv') {
    throw new Error('仅支持微信或支付宝 CSV/XLS/XLSX 账单')
  }

  const content = await readCSVWithEncodingFallback(bytes)
  const source = detectSource(content)
  if (!source) throw new Error('仅支持微信或支付宝 CSV/XLS/XLSX 账单')
  return {
    source,
    transactions: source === 'wechat' ? parseWechatCSV(content) : parseAlipayCSV(content),
  }
}

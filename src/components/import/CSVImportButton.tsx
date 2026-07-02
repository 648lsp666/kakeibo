import { useRef } from 'react'
import { parseWechatCSV, parseWechatXLSX } from '../../lib/csv-wechat'
import { parseAlipayCSV } from '../../lib/csv-alipay'
import type { Transaction } from '../../types'

interface Props {
  onParsed: (txs: Transaction[], source: 'wechat' | 'alipay') => void
  onError: (msg: string) => void
}

function detectSource(content: string): 'wechat' | 'alipay' {
  return content.includes('微信支付账单') || content.includes('微信支付') ? 'wechat' : 'alipay'
}

async function readCSVWithEncodingFallback(buffer: ArrayBuffer): Promise<string> {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (utf8.includes('交易时间')) return utf8
  // Alipay and older WeChat CSV files use GBK encoding
  return new TextDecoder('gbk').decode(buffer)
}

export function CSVImportButton({ onParsed, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer()
        const txs = await parseWechatXLSX(buffer)
        onParsed(txs, 'wechat')
      } else {
        const buffer = await file.arrayBuffer()
        const content = await readCSVWithEncodingFallback(buffer)
        const source = detectSource(content)
        const txs = source === 'wechat' ? parseWechatCSV(content) : parseAlipayCSV(content)
        onParsed(txs, source)
      }
    } catch (err) {
      onError((err as Error).message)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        style={{ background: 'var(--color-tag-system)', color: 'var(--color-text-secondary)', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 500, cursor: 'pointer' }}
      >
        📥 导入 CSV
      </button>
    </>
  )
}

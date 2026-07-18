import { useRef } from 'react'
import { parseBillFile } from '../../lib/bill-file'
import type { Transaction } from '../../types'
import { Icon } from '../ui/Icon'

interface Props {
  onParsed: (txs: Transaction[], source: 'wechat' | 'alipay') => void
  onError: (msg: string) => void
}

export function CSVImportButton({ onParsed, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await parseBillFile(file.name, await file.arrayBuffer())
      onParsed(result.transactions, result.source)
    } catch (err) {
      onError((err as Error).message)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{ background: 'var(--color-tag-system)', color: 'var(--color-text-small)', border: 'none', borderRadius: 10, minHeight: 44, padding: '0 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Icon name="download" size={16} />
        <span>导入账单</span>
      </button>
    </>
  )
}

import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { MonthHeader } from '../components/ledger/MonthHeader'
import { MonthPickerSheet } from '../components/ledger/MonthPickerSheet'
import { TransactionList } from '../components/ledger/TransactionList'
import { CSVImportButton } from '../components/import/CSVImportButton'
import { CSVPreviewSheet } from '../components/import/CSVPreviewSheet'
import { transactionOps } from '../lib/db'
import type { Transaction } from '../types'

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function LedgerPage() {
  const { currentMonth, setCurrentMonth } = useAppStore()
  const { transactions, summary, deleteTransaction, importTransactions } = useTransactions(currentMonth)
  const { categories } = useCategories()

  const [preview, setPreview] = useState<{ txs: Transaction[]; source: 'wechat' | 'alipay'; duplicateIds: Set<string> } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const handleParsed = async (txs: Transaction[], source: 'wechat' | 'alipay') => {
    const allManual = (await transactionOps.getAll()).filter(t => t.source === 'manual')
    const manualKeys = new Set(allManual.map(t => `${t.categoryId}|${t.amount.toFixed(2)}`))
    const duplicateIds = new Set(txs.filter(t => manualKeys.has(`${t.categoryId}|${t.amount.toFixed(2)}`)).map(t => t.id))
    setPreview({ txs, source, duplicateIds })
  }

  const handleConfirm = async () => {
    if (!preview) return
    setImporting(true)
    const result = await importTransactions(preview.txs)
    setImporting(false)
    setPreview(null)
    setImportMsg(`✅ 导入完成：新增 ${result.added} 条，跳过重复 ${result.skipped} 条`)
    setTimeout(() => setImportMsg(''), 4000)
  }

  const importButton = (
    <CSVImportButton
      onParsed={handleParsed}
      onError={msg => alert(`导入失败：${msg}`)}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MonthHeader
        yearMonth={currentMonth}
        summary={summary}
        importButton={importButton}
        onPrev={() => setCurrentMonth(shiftMonth(currentMonth, -1))}
        onNext={() => setCurrentMonth(shiftMonth(currentMonth, 1))}
        onPickMonth={() => setShowPicker(true)}
      />

      {importMsg && (
        <div style={{ margin: '8px 12px 0', padding: '8px 12px', background: '#f0fdf4', borderRadius: 10, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          {importMsg}
        </div>
      )}

      <TransactionList transactions={transactions} categories={categories} onDelete={deleteTransaction} />

      {preview && (
        <CSVPreviewSheet
          transactions={preview.txs}
          source={preview.source}
          duplicateIds={preview.duplicateIds}
          onConfirm={handleConfirm}
          onCancel={() => setPreview(null)}
          importing={importing}
        />
      )}

      {showPicker && (
        <MonthPickerSheet
          value={currentMonth}
          onChange={setCurrentMonth}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

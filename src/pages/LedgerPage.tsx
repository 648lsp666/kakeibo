import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { MonthHeader } from '../components/ledger/MonthHeader'
import { MonthPickerSheet } from '../components/ledger/MonthPickerSheet'
import { TransactionList } from '../components/ledger/TransactionList'
import { CSVImportButton } from '../components/import/CSVImportButton'
import { CSVPreviewSheet } from '../components/import/CSVPreviewSheet'
import { InlineNotice } from '../components/ui/Feedback'
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
  const [importError, setImportError] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const handleParsed = async (txs: Transaction[], source: 'wechat' | 'alipay') => {
    setImportError('')
    const allManual = (await transactionOps.getAll()).filter(t => t.source === 'manual')
    const manualKeys = new Set(allManual.map(t => `${t.categoryId}|${t.amount.toFixed(2)}`))
    const duplicateIds = new Set(txs.filter(t => manualKeys.has(`${t.categoryId}|${t.amount.toFixed(2)}`)).map(t => t.id))
    setPreview({ txs, source, duplicateIds })
  }

  const handleConfirm = async () => {
    if (!preview || importing) return
    setImporting(true)
    setImportError('')
    try {
      const result = await importTransactions(preview.txs)
      setPreview(null)
      setImportMsg(`导入完成：新增 ${result.added} 条，跳过重复 ${result.skipped} 条`)
      setTimeout(() => setImportMsg(''), 4000)
    } catch (error) {
      const message = error instanceof Error ? error.message : '请稍后重试'
      setImportError(`导入失败：${message}`)
    } finally {
      setImporting(false)
    }
  }

  const importButton = (
    <CSVImportButton
      onParsed={handleParsed}
      onError={msg => {
        setImportMsg('')
        setImportError(`导入失败：${msg}`)
      }}
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

      {(importMsg || (importError && !preview)) && (
        <div style={{ margin: '10px 16px 0' }}>
          {importMsg && <InlineNotice tone="success">{importMsg}</InlineNotice>}
          {importError && <InlineNotice tone="error">{importError}</InlineNotice>}
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
          error={importError}
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

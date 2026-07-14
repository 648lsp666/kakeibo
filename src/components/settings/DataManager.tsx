import { useState } from 'react'
import { transactionOps, categoryOps, getDb } from '../../lib/db'
import { seedCategories } from '../../lib/seed'
import { ConfirmDialog, InlineNotice } from '../ui/Feedback'
import { Icon } from '../ui/Icon'

export function DataManager() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  const handleExport = async () => {
    const [transactions, categories] = await Promise.all([
      transactionOps.getAll(),
      categoryOps.list(),
    ])
    const blob = new Blob(
      [JSON.stringify({ transactions, categories }, null, 2)],
      { type: 'application/json' }
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kakeibo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      const db = await getDb()
      await db.clear('transactions')
      await seedCategories()
      setConfirmOpen(false)
      setCleared(true)
    } finally {
      setClearing(false)
    }
  }

  const btnBase: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
    minHeight: 'var(--tap-size)',
    fontSize: 13,
    fontWeight: 700,
  }

  return (
    <div>
      <p style={{ color: 'var(--color-text-small)', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        导出本地备份，或清空已有账单记录。
      </p>
      <button
        type="button"
        onClick={handleExport}
        className="secondary-button"
        style={{ ...btnBase, marginBottom: 10 }}
      >
        <Icon name="download" size={18} />
        导出全部数据 JSON
      </button>
      <button
        type="button"
        onClick={() => {
          setCleared(false)
          setConfirmOpen(true)
        }}
        className="secondary-button"
        style={{ ...btnBase, background: 'var(--color-danger-soft)', color: 'var(--color-expense)' }}
      >
        <Icon name="trash" size={18} />
        清除所有账单记录
      </button>
      {cleared && (
        <div style={{ marginTop: 12 }}>
          <InlineNotice tone="success">已清除所有账单记录</InlineNotice>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="清除所有账单？"
        description="所有账单记录将被删除，此操作不可恢复。"
        confirmLabel={clearing ? '清除中…' : '确认清除'}
        tone="danger"
        busy={clearing}
        onConfirm={handleClear}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}

import { transactionOps, categoryOps, getDb } from '../../lib/db'
import { seedCategories } from '../../lib/seed'

export function DataManager() {
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
    if (!confirm('确认清除所有账单数据？此操作不可恢复。')) return
    const db = await getDb()
    await db.clear('transactions')
    await seedCategories()
    alert('已清除所有账单记录')
  }

  const btnBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 0',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 8,
  }

  return (
    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 12 }}>数据管理</div>
      <button
        onClick={handleExport}
        style={{ ...btnBase, background: 'var(--color-bg-card)', color: 'var(--color-text)' }}
      >
        📤 导出全部数据 JSON
      </button>
      <button
        onClick={handleClear}
        style={{ ...btnBase, background: '#fff1f2', color: '#e11d48', marginBottom: 0 }}
      >
        🗑️ 清除所有账单记录
      </button>
    </div>
  )
}

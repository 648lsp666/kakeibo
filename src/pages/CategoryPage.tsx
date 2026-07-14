import { useState } from 'react'
import { CategoryForm } from '../components/category/CategoryForm'
import { CategoryList } from '../components/category/CategoryList'
import { ConfirmDialog } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { Sheet } from '../components/ui/Sheet'
import { useCategories, type NewCategoryInput } from '../hooks/useCategories'
import type { Category } from '../types'

export function CategoryPage() {
  const { categories, addCategory, deleteCategory } = useCategories()
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [formSaving, setFormSaving] = useState(false)

  const handleSave = async (data: NewCategoryInput) => {
    await addCategory(data)
    setShowForm(false)
  }

  const handleDelete = async () => {
    if (!pendingDelete || pendingDelete.isSystem) return
    setDeleting(true)
    try {
      await deleteCategory(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page-scroll">
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--color-text)', fontSize: 24, fontWeight: 900 }}>分类管理</h1>
        <p style={{ color: 'var(--color-text-small)', fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
          整理收支分类，让每一笔账都清楚易找。
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CategoryList categories={categories} type="expense" onDelete={setPendingDelete} />
        <CategoryList categories={categories} type="income" onDelete={setPendingDelete} />
      </div>

      <button
        type="button"
        onClick={() => { setFormSaving(false); setShowForm(true) }}
        className="primary-button"
        style={{ alignItems: 'center', display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, width: '100%' }}
      >
        <Icon name="plus" size={18} />
        新建分类
      </button>

      <Sheet
        open={showForm}
        title="新建分类"
        description="选择收支类型和图标，再给分类起个名字。"
        onClose={() => setShowForm(false)}
        closeDisabled={formSaving}
        busy={formSaving}
      >
        <CategoryForm onSave={handleSave} onCancel={() => setShowForm(false)} onSavingChange={setFormSaving} />
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除分类？"
        description={pendingDelete ? `确定删除「${pendingDelete.name}」吗？已有账单不会被删除。` : ''}
        confirmLabel={deleting ? '删除中…' : '删除'}
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}

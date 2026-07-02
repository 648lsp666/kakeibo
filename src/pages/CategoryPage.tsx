import { useState } from 'react'
import { useCategories } from '../hooks/useCategories'
import { CategoryList } from '../components/category/CategoryList'
import { CategoryForm } from '../components/category/CategoryForm'
import type { TransactionType } from '../types'

export function CategoryPage() {
  const { categories, addCategory, deleteCategory } = useCategories()
  const [showForm, setShowForm] = useState(false)

  const handleSave = async (data: { name: string; emoji: string; type: TransactionType }) => {
    await addCategory(data)
    setShowForm(false)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)', marginBottom: 16 }}>分类管理</div>

      <CategoryList categories={categories} type="expense" onDelete={deleteCategory} />
      <CategoryList categories={categories} type="income" onDelete={deleteCategory} />

      <button
        onClick={() => setShowForm(true)}
        style={{ width: '100%', marginTop: 4, padding: '12px 0', background: 'transparent', border: '2px dashed var(--color-border)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', cursor: 'pointer' }}
      >
        ＋ 新建分类
      </button>

      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 430, margin: '0 auto' }}
            onClick={e => e.stopPropagation()}
          >
            <CategoryForm onSave={handleSave} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

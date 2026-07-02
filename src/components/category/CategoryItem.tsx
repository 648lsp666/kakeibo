import type { Category } from '../../types'

interface Props {
  category: Category
  onDelete: (id: string) => void
}

export function CategoryItem({ category, onDelete }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: 12, marginBottom: 4 }}>
      <span style={{ fontSize: 22 }}>{category.emoji}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{category.name}</span>
      <span style={{
        fontSize: 10, padding: '2px 8px', borderRadius: 20,
        background: category.isSystem ? 'var(--color-tag-system)' : 'var(--color-tag-custom)',
        color: category.isSystem ? 'var(--color-tag-system-text)' : 'var(--color-tag-custom-text)',
        fontWeight: 500,
      }}>
        {category.isSystem ? '系统' : '自定义'}
      </span>
      {!category.isSystem && (
        <button
          onClick={() => { if (confirm(`删除「${category.name}」？`)) onDelete(category.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)', padding: '0 4px' }}
        >
          🗑️
        </button>
      )}
    </div>
  )
}

import type { Category, TransactionType } from '../../types'
import { CategoryItem } from './CategoryItem'

interface Props {
  categories: Category[]
  type: TransactionType
  onDelete: (id: string) => void
}

const LABELS: Record<TransactionType, string> = {
  expense: '支出分类',
  income: '收入分类',
}

export function CategoryList({ categories, type, onDelete }: Props) {
  const filtered = categories.filter(c => c.type === type)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        {LABELS[type]}
      </div>
      {filtered.map(c => (
        <CategoryItem key={c.id} category={c} onDelete={onDelete} />
      ))}
    </div>
  )
}

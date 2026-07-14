import type { Category, TransactionType } from '../../types'
import { CategoryItem } from './CategoryItem'

interface Props {
  categories: Category[]
  type: TransactionType
  onDelete: (category: Category) => void
}

const LABELS: Record<TransactionType, { title: string; description: string }> = {
  expense: { title: '支出分类', description: '用于记录日常消费' },
  income: { title: '收入分类', description: '用于记录工资和其他收入' },
}

export function CategoryList({ categories, type, onDelete }: Props) {
  const filtered = categories.filter((category) => category.type === type)
  const label = LABELS[type]

  return (
    <section className="surface" aria-labelledby={`${type}-category-title`} style={{ padding: '16px 18px' }}>
      <header style={{ marginBottom: 6 }}>
        <h2 id={`${type}-category-title`} style={{ color: 'var(--color-text)', fontSize: 16, fontWeight: 800 }}>
          {label.title}
        </h2>
        <p style={{ color: 'var(--color-text-small)', fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>
          {label.description}
        </p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {filtered.map((category, index) => (
          <div
            key={category.id}
            style={index > 0 ? { borderTop: '1px solid var(--color-border)' } : undefined}
          >
            <CategoryItem category={category} onDelete={onDelete} />
          </div>
        ))}
      </div>
    </section>
  )
}

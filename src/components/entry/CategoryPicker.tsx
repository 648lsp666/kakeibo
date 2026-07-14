import type { Category, TransactionType } from '../../types'
import { categoryIconName, Icon } from '../ui/Icon'

interface Props {
  categories: Category[]
  type: TransactionType
  selectedId: string
  onSelect: (id: string) => void
}

export function CategoryPicker({ categories, type, selectedId, onSelect }: Props) {
  const filtered = categories.filter((category) => category.type === type)

  return (
    <div aria-label="分类" role="group" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {filtered.map((category) => {
        const selected = selectedId === category.id
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(category.id)}
            style={{
              alignItems: 'center',
              background: selected ? 'var(--color-primary-soft)' : 'var(--color-bg-secondary)',
              border: selected ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: 'var(--radius-control)',
              color: selected ? 'var(--color-primary-strong)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 68,
              padding: '8px 4px',
            }}
          >
            <span
              aria-hidden="true"
              style={{ alignItems: 'center', background: 'var(--color-bg-card)', borderRadius: 999, display: 'inline-flex', height: 30, justifyContent: 'center', width: 30 }}
            >
              <Icon name={categoryIconName(category)} size={18} />
            </span>
            <span style={{ color: 'var(--color-text)', fontSize: 10, fontWeight: selected ? 750 : 550, marginTop: 4 }}>
              {category.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

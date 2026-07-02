import type { Category, TransactionType } from '../../types'

const CATEGORY_BG: Record<string, string> = {
  'sys-food': '#fef9c3', 'sys-shop': '#f0f9ff', 'sys-transit': '#f0fdf4',
  'sys-fun': '#fdf4ff', 'sys-home': '#fff7ed', 'sys-medical': '#f0f9ff',
  'sys-edu': '#fef9c3', 'sys-other-ex': '#f5f5f5',
  'sys-salary': '#f0fdf4', 'sys-freelance': '#fef9c3', 'sys-other-in': '#fdf4ff',
}

interface Props {
  categories: Category[]
  type: TransactionType
  selectedId: string
  onSelect: (id: string) => void
}

export function CategoryPicker({ categories, type, selectedId, onSelect }: Props) {
  const filtered = categories.filter(c => c.type === type)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {filtered.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '8px 4px',
            background: CATEGORY_BG[cat.id] ?? 'var(--color-bg-secondary)',
            border: selectedId === cat.id ? '2px solid var(--color-tab-active)' : '2px solid transparent',
            borderRadius: 11, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 22 }}>{cat.emoji}</span>
          <span style={{ fontSize: 9, fontWeight: selectedId === cat.id ? 700 : 500, color: 'var(--color-text)', marginTop: 3 }}>
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  )
}

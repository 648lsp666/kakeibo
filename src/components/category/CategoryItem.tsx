import type { Category } from '../../types'
import { categoryIconName, Icon } from '../ui/Icon'

interface Props {
  category: Category
  onDelete: (category: Category) => void
}

export function CategoryItem({ category, onDelete }: Props) {
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        gap: 12,
        minHeight: 'var(--tap-size)',
        padding: '10px 0',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          alignItems: 'center',
          background: 'var(--color-primary-soft)',
          borderRadius: 12,
          color: 'var(--color-primary-strong)',
          display: 'flex',
          flexShrink: 0,
          height: 40,
          justifyContent: 'center',
          width: 40,
        }}
      >
        <Icon name={categoryIconName(category)} size={20} />
      </span>
      <span style={{ color: 'var(--color-text)', flex: 1, fontSize: 14, fontWeight: 700, minWidth: 0 }}>
        {category.name}
      </span>
      {category.isSystem ? (
        <span style={{ color: 'var(--color-text-small)', fontSize: 11 }}>系统</span>
      ) : (
        <button
          type="button"
          className="icon-button"
          aria-label={`删除${category.name}`}
          onClick={() => onDelete(category)}
          style={{ color: 'var(--color-expense-text)', flexShrink: 0 }}
        >
          <Icon name="trash" size={18} />
        </button>
      )}
    </div>
  )
}

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useBudget } from '../../hooks/useBudget'
import { BudgetCard } from './BudgetCard'
import { BudgetSetupSheet } from './BudgetSetupSheet'
import type { BudgetRule } from '../../types'
import { EmptyState } from '../ui/Feedback'
import { Icon } from '../ui/Icon'

export function BudgetSection() {
  const { rules, statuses, addRule, updateRule, deleteRule } = useBudget()
  const [editing, setEditing] = useState<BudgetRule | 'new' | null>(null)

  return (
    <section className="surface" style={{ marginTop: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: rules.length > 0 ? 12 : 0 }}>
        <h2 style={{ alignItems: 'center', display: 'flex', fontSize: 14, fontWeight: 800, color: 'var(--color-text)', gap: 8 }}>
          <Icon name="target" size={18} />预算规则
        </h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="secondary-button"
          style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
        >
          + 添加
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon="target"
          title="还没有预算规则"
          description="设置月、年或自定义预算，及时了解消费进度。"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {statuses.map(rs => (
            <BudgetCard key={rs.rule.id} rs={rs} onEdit={() => setEditing(rs.rule)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing !== null && (
          <BudgetSetupSheet
            current={editing === 'new' ? null : editing}
            onSave={async (data) => {
              if (editing === 'new') await addRule(data)
              else await updateRule({ ...data, id: editing.id })
              setEditing(null)
            }}
            onDelete={async () => {
              if (editing !== 'new') await deleteRule(editing.id)
              setEditing(null)
            }}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

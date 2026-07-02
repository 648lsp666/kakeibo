import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useBudget } from '../../hooks/useBudget'
import { BudgetCard } from './BudgetCard'
import { BudgetSetupSheet } from './BudgetSetupSheet'
import type { BudgetRule } from '../../types'

export function BudgetSection() {
  const { rules, statuses, addRule, updateRule, deleteRule } = useBudget()
  const [editing, setEditing] = useState<BudgetRule | 'new' | null>(null)

  return (
    <div style={{ margin: '12px 16px 0', background: 'var(--color-stat-card)', borderRadius: 14, padding: 14, boxShadow: '0 1px 4px var(--color-stat-shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: rules.length > 0 ? 12 : 0 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text)' }}>🎯 预算规则</span>
        <button
          onClick={() => setEditing('new')}
          style={{ background: 'var(--color-bg-secondary)', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', cursor: 'pointer' }}
        >
          + 添加
        </button>
      </div>

      {rules.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', padding: '6px 0 2px' }}>
          点击「+ 添加」设置预算规则，支持月/年/自定义多规则并行
        </div>
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
    </div>
  )
}

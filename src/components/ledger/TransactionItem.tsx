import { useRef } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import type { Transaction, Category } from '../../types'

interface Props {
  tx: Transaction
  category?: Category
  onDelete: (id: string) => void
}

const SOURCE_LABEL: Record<string, string> = {
  manual: '手动',
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
}

const SOURCE_STYLE: Record<string, { bg: string; color: string }> = {
  manual: { bg: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' },
  wechat: { bg: 'rgba(7,193,96,0.12)', color: '#07c160' },
  alipay: { bg: 'rgba(0,160,233,0.12)', color: '#0094d8' },
  bank: { bg: 'rgba(139,92,246,0.12)', color: '#7c3aed' },
}

const DELETE_W = 72

export function TransactionItem({ tx, category, onDelete }: Props) {
  const isExpense = tx.type === 'expense'
  const sign = isExpense ? '-' : '+'
  const amtColor = isExpense ? 'var(--color-expense)' : 'var(--color-income)'

  const x = useMotionValue(0)
  const isOpen = useRef(false)

  const snapTo = (target: number) => {
    animate(x, target, { type: 'spring', stiffness: 400, damping: 35 })
    isOpen.current = target !== 0
  }

  const handleDragEnd = () => {
    snapTo(x.get() < -(DELETE_W / 2) ? -DELETE_W : 0)
  }

  const srcLabel = SOURCE_LABEL[tx.source] ?? tx.source
  const srcStyle = SOURCE_STYLE[tx.source] ?? SOURCE_STYLE.manual

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--color-border)' }}>
      {/* Delete button revealed on left swipe */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_W,
        background: '#ef4444',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <button
          onClick={() => { if (confirm('删除这条记录？')) onDelete(tx.id) }}
          style={{ color: '#fff', background: 'none', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '8px 10px', lineHeight: 1.4, textAlign: 'center' }}
        >
          🗑<br />删除
        </button>
      </div>

      {/* Swipeable row */}
      <motion.div
        style={{ x, position: 'relative', zIndex: 1, background: 'var(--color-bg)', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', touchAction: 'pan-y' }}
        drag="x"
        dragConstraints={{ left: -DELETE_W, right: 0 }}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        onClick={() => { if (isOpen.current) snapTo(0) }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: 'var(--color-bg-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 19, flexShrink: 0,
        }}>
          {category?.emoji ?? '📦'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.note || category?.name || '其他'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            {category?.name && (
              <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{category.name}</span>
            )}
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: srcStyle.bg, color: srcStyle.color, flexShrink: 0 }}>
              {srcLabel}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: amtColor, flexShrink: 0 }}>
          {sign}¥{tx.amount.toFixed(2)}
        </div>
      </motion.div>
    </div>
  )
}

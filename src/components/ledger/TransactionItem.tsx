import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, animate } from 'framer-motion'
import type { Transaction, Category } from '../../types'
import { Icon, categoryIconName } from '../ui/Icon'
import { ConfirmDialog } from '../ui/Feedback'

interface Props {
  tx: Transaction
  category?: Category
  onDelete: (id: string) => void | Promise<void>
}

const SOURCE_LABEL: Record<string, string> = {
  manual: '手动',
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
}

const SOURCE_STYLE: Record<string, { bg: string; color: string }> = {
  manual: { bg: 'var(--color-bg-secondary)', color: 'var(--color-text-small)' },
  wechat: { bg: 'var(--color-source-wechat-soft)', color: 'var(--color-source-wechat)' },
  alipay: { bg: 'var(--color-source-alipay-soft)', color: 'var(--color-source-alipay)' },
  bank: { bg: 'var(--color-source-bank-soft)', color: 'var(--color-source-bank)' },
}

const DELETE_W = 72

export function TransactionItem({ tx, category, onDelete }: Props) {
  const isExpense = tx.type === 'expense'
  const sign = isExpense ? '-' : '+'
  const amtColor = isExpense ? 'var(--color-expense-text)' : 'var(--color-income-text)'

  const x = useMotionValue(0)
  const isOpen = useRef(false)
  const deletingRef = useRef(false)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const itemLabel = tx.note || category?.name || '记录'

  const snapTo = (target: number) => {
    animate(x, target, { type: 'spring', stiffness: 400, damping: 35 })
    isOpen.current = target !== 0
  }

  const handleDragEnd = () => {
    snapTo(x.get() < -(DELETE_W / 2) ? -DELETE_W : 0)
  }

  const srcLabel = SOURCE_LABEL[tx.source] ?? tx.source
  const srcStyle = SOURCE_STYLE[tx.source] ?? SOURCE_STYLE.manual

  const requestDelete = () => setConfirming(true)
  const handleDelete = async () => {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    const row = deleteTriggerRef.current?.closest('li')
    const adjacentFocusTarget = (row?.nextElementSibling ?? row?.previousElementSibling)
      ?.querySelector<HTMLElement>('button[aria-label^="删除"]') ?? null
    try {
      await onDelete(tx.id)
      setConfirming(false)
      window.setTimeout(() => {
        const focusTarget = adjacentFocusTarget?.isConnected
          ? adjacentFocusTarget
          : document.querySelector<HTMLElement>('[data-ledger-focus-target]')
        focusTarget?.focus()
      }, 0)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  return (
    <>
    <li style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--color-border)' }}>
      {/* Delete button revealed on left swipe */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_W,
        background: 'var(--color-expense)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <button
          ref={deleteTriggerRef}
          type="button"
          aria-label={`滑动删除${itemLabel}`}
          tabIndex={-1}
          onClick={requestDelete}
          style={{ width: '100%', height: '100%', color: 'var(--color-on-danger)', background: 'none', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '8px 10px', lineHeight: 1.4, textAlign: 'center', display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 3 }}
        >
          <Icon name="trash" size={18} />
          <span>删除</span>
        </button>
      </div>

      {/* Swipeable row */}
      <motion.div
        style={{ x, position: 'relative', zIndex: 1, background: 'var(--color-bg-card)', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px', touchAction: 'pan-y' }}
        drag="x"
        dragConstraints={{ left: -DELETE_W, right: 0 }}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        onClick={() => { if (isOpen.current) snapTo(0) }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 13,
          background: 'var(--color-primary-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-primary-strong)', flexShrink: 0,
        }}>
          <Icon name={categoryIconName(category)} size={20} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.note || category?.name || '其他'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            {category?.name && (
              <span style={{ minWidth: 0, maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: 'var(--color-text-secondary)' }}>{category.name}</span>
            )}
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: srcStyle.bg, color: srcStyle.color, flexShrink: 0 }}>
              {srcLabel}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: amtColor, flexShrink: 0 }}>
          {sign}¥{tx.amount.toFixed(2)}
        </div>
        <button
          type="button"
          aria-label={`删除${itemLabel}`}
          onClick={(event) => { event.stopPropagation(); requestDelete() }}
          className="icon-button"
          style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
        >
          <Icon name="trash" size={17} />
        </button>
      </motion.div>
    </li>
    {confirming && createPortal(
      <ConfirmDialog
        open
        title="删除这条记录？"
        description={`确定删除「${itemLabel}」吗？删除后无法恢复。`}
        confirmLabel={deleting ? '删除中…' : '确认删除'}
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirming(false)}
      />,
      document.body,
    )}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { usePendingBills } from '../../bill-inbox/usePendingBills'
import type { BillCompletion, PendingBill } from '../../bill-inbox/types'
import { parseEncryptedBillArchive } from '../../lib/bill-archive'
import type { ParsedBillFile } from '../../lib/bill-file'
import { ConfirmDialog, InlineNotice } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  onParsed: (
    result: ParsedBillFile,
    bill: PendingBill,
    complete: (completion: BillCompletion) => Promise<void>,
  ) => void | Promise<void>
}

function receivedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '收到时间未知'
  return `${date.getMonth() + 1}月${date.getDate()}日收到`
}

export function PendingBillsCard({ onParsed }: Props) {
  const inbox = usePendingBills()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PendingBill | null>(null)
  const shouldReduceMotion = useReducedMotion()
  const initializedExpansion = useRef(false)

  useEffect(() => {
    if (inbox.bills.length === 0) {
      setExpandedId(null)
      initializedExpansion.current = false
      return
    }
    if (!initializedExpansion.current) {
      initializedExpansion.current = true
      setExpandedId(inbox.bills[0].id)
      return
    }
    if (expandedId && !inbox.bills.some(bill => bill.id === expandedId)) {
      setExpandedId(inbox.bills[0].id)
    }
  }, [expandedId, inbox.bills])

  if (inbox.bills.length === 0) return null

  const process = async (bill: PendingBill) => {
    if (!password) {
      setError('请输入解压密码')
      return
    }
    const currentPassword = password
    setBusyId(bill.id)
    setError('')
    try {
      const bytes = await inbox.download(bill)
      const result = await parseEncryptedBillArchive(bytes, currentPassword)
      setPassword('')
      await onParsed(result, bill, completion => inbox.complete(bill.id, completion))
    } catch (cause) {
      setPassword('')
      setError(cause instanceof Error ? cause.message : '账单识别失败，请重试')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    setError('')
    try {
      await inbox.remove(deleteTarget.id)
      setDeleteTarget(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败，请重试')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="surface" aria-label="待处理账单" style={{ margin: '12px 16px 0', overflow: 'hidden' }}>
      <header style={{ alignItems: 'center', display: 'flex', gap: 10, padding: '13px 14px 10px' }}>
        <span style={{ color: 'var(--color-primary-strong)', display: 'inline-flex' }}>
          <Icon name="mail" size={19} />
        </span>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--color-text)', fontSize: 13, fontWeight: 800 }}>待处理账单</h2>
          <p style={{ color: 'var(--color-text-small)', fontSize: 11, marginTop: 2 }}>输入邮件中的密码后即可识别</p>
        </div>
        <span style={{ background: 'var(--color-tag-system)', borderRadius: 999, color: 'var(--color-text-small)', fontSize: 11, fontWeight: 750, padding: '4px 8px' }}>
          {inbox.bills.length} 份
        </span>
        <button type="button" aria-label="刷新待处理账单" className="icon-button" disabled={inbox.loading} onClick={() => { void inbox.refresh() }}>
          <Icon name="refresh" size={17} />
        </button>
      </header>

      {(inbox.error || error) && (
        <div style={{ padding: '0 14px 10px' }}><InlineNotice tone="error">{error || inbox.error}</InlineNotice></div>
      )}

      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        {inbox.bills.map((bill, index) => {
          const expanded = bill.id === expandedId
          return (
            <article key={bill.id} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--color-border)', padding: '11px 14px' }}>
              <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? '收起' : '展开'} ${bill.filename}`}
                  onClick={() => {
                    setExpandedId(expanded ? null : bill.id)
                    setPassword('')
                    setError('')
                  }}
                  style={{ alignItems: 'flex-start', background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', display: 'flex', flex: 1, gap: 9, padding: 0, textAlign: 'left' }}
                >
                  <span className="motion-chevron" data-expanded={expanded}><Icon name="chevron-right" size={17} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ color: 'var(--color-text)', display: 'block', fontSize: 12, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bill.filename}</span>
                    <span style={{ color: 'var(--color-text-small)', display: 'block', fontSize: 10, marginTop: 3 }}>{receivedLabel(bill.receivedAt)}</span>
                  </span>
                </button>
                <button type="button" aria-label={`删除 ${bill.filename}`} className="icon-button" disabled={busyId === bill.id} onClick={() => setDeleteTarget(bill)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>

              {expanded && (
              <motion.div
                className="motion-enter"
                initial={{ opacity: 0, transform: shouldReduceMotion ? 'translateY(0)' : 'translateY(-4px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ duration: shouldReduceMotion ? 0.16 : 0.18, ease: [0.23, 1, 0.32, 1] }}
              >
              {bill.status === 'failed' && (
                <div style={{ marginTop: 10 }}><InlineNotice tone="error">{bill.failureReason ?? '暂不支持这份账单附件'}</InlineNotice></div>
              )}

              {bill.status === 'pending' && (
                <form
                  onSubmit={event => { event.preventDefault(); void process(bill) }}
                  style={{ display: 'grid', gap: 8, marginTop: 11 }}
                >
                  <label htmlFor={`bill-password-${bill.id}`} style={{ color: 'var(--color-text-small)', fontSize: 11, fontWeight: 700 }}>
                    解压密码
                  </label>
                  <input
                    id={`bill-password-${bill.id}`}
                    aria-label={`${bill.filename} 解压密码`}
                    type="password"
                    autoComplete="off"
                    value={password}
                    disabled={busyId === bill.id}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="密码仅在本机使用"
                    style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', color: 'var(--color-text)', fontSize: 13, minHeight: 44, padding: '0 12px', width: '100%' }}
                  />
                  <button type="submit" className="primary-button" disabled={busyId === bill.id}>
                    {busyId === bill.id ? '识别中…' : '输入密码并识别'}
                  </button>
                </form>
              )}
              </motion.div>
              )}
            </article>
          )
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="永久删除这份账单？"
        description={deleteTarget ? `「${deleteTarget.filename}」及服务器附件会立即删除，无法撤销。` : ''}
        confirmLabel="永久删除"
        busy={Boolean(deleteTarget && busyId === deleteTarget.id)}
        error={error || undefined}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { void remove() }}
      />
    </section>
  )
}

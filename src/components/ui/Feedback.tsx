import { Icon, type IconName } from './Icon'
import { Sheet } from './Sheet'

export type NoticeTone = 'success' | 'warning' | 'error' | 'info'

const noticeStyles: Record<NoticeTone, { background: string; color: string; icon: IconName }> = {
  success: { background: 'var(--color-primary-soft)', color: 'var(--color-income)', icon: 'check' },
  warning: { background: 'var(--color-bg-secondary)', color: 'var(--color-warning)', icon: 'warning' },
  error: { background: 'var(--color-danger-soft)', color: 'var(--color-expense)', icon: 'warning' },
  info: { background: 'var(--color-bg-secondary)', color: 'var(--color-primary-strong)', icon: 'info' },
}

export function InlineNotice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}): React.ReactNode {
  const style = noticeStyles[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        alignItems: 'flex-start',
        background: style.background,
        borderRadius: 'var(--radius-control)',
        color: style.color,
        display: 'flex',
        fontSize: 13,
        fontWeight: 600,
        gap: 10,
        lineHeight: 1.5,
        padding: '12px 14px',
      }}
    >
      <Icon name={style.icon} size={18} />
      <div style={{ color: 'var(--color-text)', flex: 1 }}>{children}</div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: IconName
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}): React.ReactNode {
  return (
    <section style={{ color: 'var(--color-text)', padding: '48px 24px', textAlign: 'center' }}>
      <div
        style={{
          alignItems: 'center',
          background: 'var(--color-primary-soft)',
          borderRadius: 999,
          color: 'var(--color-primary-strong)',
          display: 'inline-flex',
          height: 56,
          justifyContent: 'center',
          marginBottom: 16,
          width: 56,
        }}
      >
        <Icon name={icon} size={28} />
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {description && (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.6, margin: '8px auto 0', maxWidth: 280 }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button type="button" className="primary-button" onClick={onAction} style={{ marginTop: 20 }}>
          {actionLabel}
        </button>
      )}
    </section>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}): React.ReactNode {
  return (
    <Sheet
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
            style={{ flex: 1 }}
          >
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={onConfirm}
            style={tone === 'danger'
              ? { background: 'var(--color-expense)', borderColor: 'var(--color-expense)', flex: 1 }
              : { flex: 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {null}
    </Sheet>
  )
}

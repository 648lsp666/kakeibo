import { useAuthSync } from '../../sync/auth-session'
import type { SyncStatus } from '../../sync/contracts'
import { useSyncStore } from '../../sync/sync-store'
import { Icon, type IconName } from '../ui/Icon'

function presentation(status: SyncStatus): { copy: string; icon: IconName; tone: 'calm' | 'warning' | 'error' } {
  switch (status.kind) {
    case 'idle': return { copy: '已同步', icon: 'check', tone: 'calm' }
    case 'syncing': return { copy: `同步中 · ${status.pending} 项`, icon: 'cloud', tone: 'calm' }
    case 'offline': return { copy: `离线 · ${status.pending} 项待同步`, icon: 'warning', tone: 'warning' }
    case 'auth-required': return { copy: '需要重新登录', icon: 'warning', tone: 'warning' }
    case 'error': return { copy: '同步失败', icon: 'warning', tone: 'error' }
    case 'local-only': return { copy: '仅保存在本机', icon: 'check', tone: 'calm' }
  }
}

export function SyncStatusPill() {
  const { session } = useAuthSync()
  const status = useSyncStore(state => state.status)
  const actionable = status.kind === 'offline' || status.kind === 'auth-required' || status.kind === 'error'

  if (!session && !actionable) return null

  const { copy, icon, tone } = presentation(status)
  const colors = tone === 'error'
    ? { background: 'var(--color-danger-soft)', color: 'var(--color-expense-text)' }
    : tone === 'warning'
      ? { background: 'var(--color-bg-secondary)', color: 'var(--color-warning-text)' }
      : { background: 'var(--color-primary-soft)', color: 'var(--color-primary-text)' }

  return (
    <div style={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-end', padding: 'max(8px, env(safe-area-inset-top)) 16px 0' }}>
      <span
        role="status"
        style={{
          ...colors,
          alignItems: 'center',
          borderRadius: 999,
          display: 'inline-flex',
          fontSize: 11,
          fontWeight: 700,
          gap: 5,
          lineHeight: 1,
          maxWidth: '100%',
          padding: '6px 9px',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon name={icon} size={14} />
        {copy}
      </span>
    </div>
  )
}

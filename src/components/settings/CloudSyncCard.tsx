import { useState } from 'react'
import { useAuthSync } from '../../sync/auth-session'
import { useSyncStore } from '../../sync/sync-store'
import type { SyncStatus } from '../../sync/contracts'
import { ConfirmDialog, InlineNotice } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试'
}

function statusText(status: SyncStatus, pending: number): string {
  switch (status.kind) {
    case 'local-only': return '仅保存在本机'
    case 'idle': return pending > 0 ? `${pending} 项待同步` : '已同步'
    case 'syncing': return `同步中 · ${status.pending} 项待同步`
    case 'offline': return `离线 · ${status.pending} 项待同步`
    case 'auth-required': return `需要重新登录 · ${status.pending} 项待同步`
    case 'error': return `同步失败 · ${status.pending} 项待同步`
  }
}

export function CloudSyncCard() {
  const auth = useAuthSync()
  const status = useSyncStore(state => state.status)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signOutPending, setSignOutPending] = useState(0)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  const sendOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    await run(async () => {
      await auth.sendOtp(email.trim())
      setNotice({ tone: 'success', text: '登录链接已发送，请检查邮箱' })
    })
  }

  const confirmMigration = () => run(auth.confirmMigration)
  const skipMigration = () => run(auth.skipMigration)
  const signOut = () => run(async () => {
    await auth.signOut()
    setSignOutOpen(false)
  })

  const prepareSignOut = () => run(async () => {
    const pending = await auth.prepareSignOut()
    setSignOutPending(pending)
    if (pending > 0) setSignOutOpen(true)
    else await auth.signOut()
  })

  return (
    <div className="surface" style={{ padding: 16 }}>
      <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
        <span style={{ color: 'var(--color-primary-strong)', display: 'inline-flex' }}>
          <Icon name="cloud" size={21} />
        </span>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: 14, fontWeight: 800 }}>账号自动同步</h3>
          <p style={{ color: 'var(--color-text-small)', fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>
            应用打开时自动同步各设备上的账本。
          </p>
        </div>
      </div>

      {!auth.session ? (
        <form onSubmit={sendOtp} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <label htmlFor="cloud-sync-email" style={{ color: 'var(--color-text-small)', fontSize: 12, fontWeight: 700 }}>
            邮箱地址
          </label>
          <input
            id="cloud-sync-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
            style={{
              background: 'var(--color-input-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--color-text)',
              fontSize: 13,
              minHeight: 'var(--tap-size)',
              padding: '0 14px',
              width: '100%',
            }}
          />
          <button type="submit" className="primary-button" disabled={busy || auth.loading}>
            {busy ? '发送中…' : '发送登录链接'}
          </button>
        </form>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ color: 'var(--color-text)', fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
            {auth.session.user.email ?? '已登录账号'}
          </div>
          <div style={{ color: 'var(--color-text-small)', fontSize: 12, marginTop: 5 }}>
            {statusText(status, auth.pending)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="secondary-button" disabled={busy} onClick={auth.retry} style={{ flex: 1 }}>
              立即重试
            </button>
            <button type="button" className="secondary-button" disabled={busy || auth.loading} onClick={() => { void prepareSignOut() }} style={{ flex: 1 }}>
              退出账号
            </button>
          </div>
        </div>
      )}

      {notice && <div style={{ marginTop: 12 }}><InlineNotice tone={notice.tone}>{notice.text}</InlineNotice></div>}
      {status.kind === 'error' && !notice && (
        <div style={{ marginTop: 12 }}><InlineNotice tone="error">{status.message}</InlineNotice></div>
      )}

      <Sheet
        open={auth.migrationRequired}
        title="合并本地账本？"
        description="继续前已生成一份本地 JSON 备份。确认后会保留原有记录 ID，并开始账号同步。"
        busy={busy || auth.loading}
        closeDisabled={auth.migrationRequired || busy || auth.loading}
        onClose={() => undefined}
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="secondary-button" disabled={busy || auth.loading} onClick={() => { void skipMigration() }} style={{ flex: 1 }}>
              暂不合并
            </button>
            <button type="button" className="primary-button" disabled={busy || auth.loading} onClick={() => { void confirmMigration() }} style={{ flex: 1 }}>
              确认合并
            </button>
          </div>
        }
      >
        {status.kind === 'error'
          ? <InlineNotice tone="error">{status.message}</InlineNotice>
          : <InlineNotice tone="info">匿名账本不会在你确认前写入账号工作区。</InlineNotice>}
      </Sheet>

      <ConfirmDialog
        open={signOutOpen}
        title="退出同步账号？"
        description={`仍有 ${signOutPending} 项待同步。退出后会保留在此账号的本地账本中。`}
        confirmLabel="确认退出"
        busy={busy}
        error={notice?.tone === 'error' ? notice.text : undefined}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => { void signOut() }}
      />
    </div>
  )
}

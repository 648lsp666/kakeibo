import { useState } from 'react'
import { useAuthSync } from '../../sync/auth-session'
import { useSyncStore } from '../../sync/sync-store'
import type { SyncStatus } from '../../sync/contracts'
import { ConfirmDialog, InlineNotice } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '操作失败，请重试'
  const detail = error.message.trim()
  if (error.name === 'AuthRetryableFetchError' || !detail || detail === '{}') {
    return '验证码邮件发送失败，请检查发件域名或 SMTP 配置后重试'
  }
  return detail
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
  const [otp, setOtp] = useState('')
  const [awaitingOtp, setAwaitingOtp] = useState(false)
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
      setAwaitingOtp(true)
      setNotice({ tone: 'success', text: '验证码已发送，请检查邮箱' })
    })
  }

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    await run(async () => {
      await auth.verifyOtp(email.trim(), otp.trim())
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
        <form onSubmit={awaitingOtp ? verifyOtp : sendOtp} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <label htmlFor="cloud-sync-email" style={{ color: 'var(--color-text-small)', fontSize: 12, fontWeight: 700 }}>
            邮箱地址
          </label>
          <input
            id="cloud-sync-email"
            type="email"
            autoComplete="email"
            required
            disabled={awaitingOtp}
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
          {awaitingOtp && (
            <>
              <label htmlFor="cloud-sync-otp" style={{ color: 'var(--color-text-small)', fontSize: 12, fontWeight: 700 }}>
                邮箱验证码
              </label>
              <input
                id="cloud-sync-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                maxLength={8}
                required
                autoFocus
                value={otp}
                onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="6–8 位验证码"
                style={{
                  background: 'var(--color-input-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-control)',
                  color: 'var(--color-text)',
                  fontSize: 18,
                  letterSpacing: '0.24em',
                  minHeight: 'var(--tap-size)',
                  padding: '0 14px',
                  textAlign: 'center',
                  width: '100%',
                }}
              />
            </>
          )}
          <button type="submit" className="primary-button" disabled={busy || auth.loading}>
            {busy ? (awaitingOtp ? '验证中…' : '发送中…') : (awaitingOtp ? '验证并登录' : '发送验证码')}
          </button>
          {awaitingOtp && (
            <button
              type="button"
              className="secondary-button"
              disabled={busy || auth.loading}
              onClick={() => { setAwaitingOtp(false); setOtp(''); setNotice(null) }}
            >
              更换邮箱
            </button>
          )}
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
          {auth.isolated > 0 && (
            <div style={{ marginTop: 12 }}>
              <InlineNotice tone="error">
                <div>{auth.isolated} 项更改需要处理</div>
                <div>{auth.isolatedReason ?? '这些更改暂时无法同步。'}</div>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => { void run(auth.retryIsolated) }} style={{ marginTop: 8 }}>
                  重试这些项目
                </button>
              </InlineNotice>
            </div>
          )}
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
        description={`仍有 ${signOutPending} 项待同步。需要处理的项目会单独保留在此账号的本地账本中。`}
        confirmLabel="确认退出"
        busy={busy}
        error={notice?.tone === 'error' ? notice.text : undefined}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => { void signOut() }}
      />
    </div>
  )
}

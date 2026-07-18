import { useEffect, useMemo, useState } from 'react'
import { createBillInboxClient } from '../../bill-inbox/client'
import type { BillInboxAddress } from '../../bill-inbox/types'
import { useAuthSync } from '../../sync/auth-session'
import { getSupabaseClientIfConfigured } from '../../sync/supabase-client'
import { ConfirmDialog, InlineNotice } from '../ui/Feedback'
import { Icon } from '../ui/Icon'

export function BillInboxConfig() {
  const auth = useAuthSync()
  const [address, setAddress] = useState<BillInboxAddress | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const service = useMemo(() => {
    const client = getSupabaseClientIfConfigured()
    const domain = import.meta.env.VITE_INBOUND_EMAIL_DOMAIN?.trim()
    if (!auth.session || !client || !domain) return null
    try {
      return createBillInboxClient(client, auth.session.user.id, domain)
    } catch {
      return null
    }
  }, [auth.session])

  useEffect(() => {
    let active = true
    setAddress(undefined)
    setNotice(null)
    if (!service) {
      setAddress(null)
      return () => { active = false }
    }
    void service.getAddress()
      .then(value => { if (active) setAddress(value) })
      .catch(error => {
        if (!active) return
        setAddress(null)
        setNotice({ tone: 'error', text: error instanceof Error ? error.message : '邮件收取状态加载失败' })
      })
    return () => { active = false }
  }, [service])

  if (!auth.session) return null

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : '操作失败，请重试' })
    } finally {
      setBusy(false)
    }
  }

  const enable = (reset: boolean) => run(async () => {
    if (!service) throw new Error('邮件账单接收域名尚未配置')
    const next = await service.enable(reset)
    setAddress(next)
    setResetOpen(false)
    setNotice({ tone: 'success', text: reset ? '已生成新的专属邮箱' : '邮件收取已开启' })
  })

  const copy = () => run(async () => {
    if (!address) return
    await navigator.clipboard.writeText(address.address)
    setNotice({ tone: 'success', text: '专属邮箱已复制' })
  })

  const disable = () => run(async () => {
    if (!service) throw new Error('邮件账单接收域名尚未配置')
    await service.disable()
    setAddress(null)
    setDisableOpen(false)
    setNotice({ tone: 'success', text: '邮件收取已关闭' })
  })

  return (
    <div className="surface" style={{ marginTop: 14, padding: 16 }}>
      <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
        <span style={{ color: 'var(--color-primary-strong)', display: 'inline-flex' }}><Icon name="mail" size={21} /></span>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: 14, fontWeight: 800 }}>邮件自动收账</h3>
          <p style={{ color: 'var(--color-text-small)', fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>
            自动接收微信、支付宝发来的加密账单。
          </p>
        </div>
      </div>

      {address === undefined ? (
        <p style={{ color: 'var(--color-text-small)', fontSize: 12, marginTop: 14 }}>正在读取邮件设置…</p>
      ) : address ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 12, color: 'var(--color-text)', fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere', padding: 12 }}>
            {address.address}
          </div>
          <p style={{ color: 'var(--color-text-small)', fontSize: 11, lineHeight: 1.6, marginTop: 9 }}>
            在常用邮箱中设置自动转发，将微信、支付宝账单邮件转发到此地址。
          </p>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
            <button type="button" className="primary-button" disabled={busy} onClick={() => { void copy() }}>复制专属邮箱</button>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => setResetOpen(true)}>重新生成</button>
          </div>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setDisableOpen(true)} style={{ marginTop: 8, width: '100%' }}>
            关闭邮件收取
          </button>
        </div>
      ) : (
        <button type="button" className="primary-button" disabled={busy || !service} onClick={() => { void enable(false) }} style={{ marginTop: 14, width: '100%' }}>
          开启邮件收取
        </button>
      )}

      {!service && <div style={{ marginTop: 12 }}><InlineNotice tone="error">邮件账单接收域名尚未配置</InlineNotice></div>}
      {notice && <div style={{ marginTop: 12 }}><InlineNotice tone={notice.tone}>{notice.text}</InlineNotice></div>}

      <ConfirmDialog
        open={resetOpen}
        title="重新生成专属邮箱？"
        description="旧地址会立即失效，请同步更新邮箱中的自动转发规则。"
        confirmLabel="确认重新生成"
        busy={busy}
        onClose={() => setResetOpen(false)}
        onConfirm={() => { void enable(true) }}
      />
      <ConfirmDialog
        open={disableOpen}
        title="关闭邮件收取？"
        description="专属地址会立即失效，所有待处理账单和服务器附件会永久删除。"
        confirmLabel="确认关闭"
        busy={busy}
        onClose={() => setDisableOpen(false)}
        onConfirm={() => { void disable() }}
      />
    </div>
  )
}

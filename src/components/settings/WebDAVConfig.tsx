import { useEffect, useRef, useState } from 'react'
import { syncConfigOps } from '../../lib/db'
import { uploadBackup, downloadAndMerge } from '../../lib/webdav'
import { InlineNotice, type NoticeTone } from '../ui/Feedback'
import { Icon } from '../ui/Icon'

type SyncStatus = { tone: NoticeTone; message: string } | null
type ActiveRequest = 'save' | 'upload' | 'download' | null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试'
}

export function WebDAVConfig() {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [lastSync, setLastSync] = useState('')
  const [status, setStatus] = useState<SyncStatus>(null)
  const [activeRequest, setActiveRequest] = useState<ActiveRequest>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    syncConfigOps.getAll().then(cfg => {
      setUrl(cfg.webdav_url ?? '')
      setUsername(cfg.webdav_username ?? '')
      setPassword(cfg.webdav_password ?? '')
      setLastSync(cfg.last_sync_at ?? '')
    })
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current)
    }
  }, [])

  const showStatus = (nextStatus: Exclude<SyncStatus, null>, clear = true) => {
    if (statusTimer.current) clearTimeout(statusTimer.current)
    setStatus(nextStatus)
    if (clear) {
      statusTimer.current = setTimeout(() => setStatus(null), 3000)
    }
  }

  const handleSave = async () => {
    setActiveRequest('save')
    try {
      await syncConfigOps.set('webdav_url', url)
      await syncConfigOps.set('webdav_username', username)
      await syncConfigOps.set('webdav_password', password)
      showStatus({ tone: 'success', message: '配置已保存' })
    } catch (error: unknown) {
      showStatus({ tone: 'error', message: errorMessage(error) })
    } finally {
      setActiveRequest(null)
    }
  }

  const handleUpload = async () => {
    setActiveRequest('upload')
    try {
      showStatus({ tone: 'info', message: '上传中…' }, false)
      await uploadBackup({ url, username, password })
      setLastSync(new Date().toISOString())
      showStatus({ tone: 'success', message: '上传成功' })
    } catch (error: unknown) {
      showStatus({ tone: 'error', message: errorMessage(error) })
    } finally {
      setActiveRequest(null)
    }
  }

  const handleDownload = async () => {
    setActiveRequest('download')
    try {
      showStatus({ tone: 'info', message: '下载中…' }, false)
      const r = await downloadAndMerge({ url, username, password })
      setLastSync(new Date().toISOString())
      showStatus({ tone: 'success', message: `同步完成：新增 ${r.added}，更新 ${r.updated}` })
    } catch (error: unknown) {
      showStatus({ tone: 'error', message: errorMessage(error) })
    } finally {
      setActiveRequest(null)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-control)',
    minHeight: 'var(--tap-size)',
    padding: '0 14px',
    fontSize: 13,
    color: 'var(--color-text)',
  }

  const btn: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    minHeight: 'var(--tap-size)',
    fontSize: 13,
    fontWeight: 700,
  }

  const fieldLabel: React.CSSProperties = {
    color: 'var(--color-text-small)', fontSize: 12, fontWeight: 700,
  }

  return (
    <div>
      <div style={{ alignItems: 'center', color: 'var(--color-primary-strong)', display: 'flex', gap: 8, marginBottom: 14 }}>
        <Icon name="cloud" size={20} />
        <div>
          <h3 style={{ color: 'var(--color-text)', fontSize: 14, fontWeight: 800 }}>手动灾备</h3>
          <p style={{ color: 'var(--color-text-small)', fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>
            WebDAV 仅用于手动备份与恢复，不参与自动同步。
          </p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label htmlFor="webdav-url" style={fieldLabel}>服务器地址</label>
        <input id="webdav-url" style={inputStyle} placeholder="https://dav.example.com" value={url} onChange={e => setUrl(e.target.value)} />
        <label htmlFor="webdav-username" style={fieldLabel}>用户名</label>
        <input id="webdav-username" style={inputStyle} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
        <label htmlFor="webdav-password" style={fieldLabel}>密码</label>
        <input id="webdav-password" style={inputStyle} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <button type="button" onClick={handleSave} disabled={activeRequest !== null} className="primary-button" style={{ ...btn, width: '100%', marginTop: 14, marginBottom: 10 }}>
        <Icon name="check" size={18} />
        {activeRequest === 'save' ? '保存中…' : '保存配置'}
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleUpload} disabled={activeRequest !== null} className="secondary-button" style={btn}>
          <Icon name="upload" size={18} />
          {activeRequest === 'upload' ? '上传中…' : '上传备份'}
        </button>
        <button type="button" onClick={handleDownload} disabled={activeRequest !== null} className="secondary-button" style={btn}>
          <Icon name="download" size={18} />
          {activeRequest === 'download' ? '下载中…' : '下载恢复'}
        </button>
      </div>
      {lastSync && (
        <div style={{ fontSize: 10, color: 'var(--color-text-small)', marginTop: 8 }}>
          上次同步：{new Date(lastSync).toLocaleString('zh-CN')}
        </div>
      )}
      {status && (
        <div style={{ marginTop: 10 }}>
          <InlineNotice tone={status.tone}>{status.message}</InlineNotice>
        </div>
      )}
    </div>
  )
}

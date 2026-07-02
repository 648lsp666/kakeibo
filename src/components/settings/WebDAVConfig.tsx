import { useState, useEffect } from 'react'
import { syncConfigOps } from '../../lib/db'
import { uploadBackup, downloadAndMerge } from '../../lib/webdav'

export function WebDAVConfig() {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [lastSync, setLastSync] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    syncConfigOps.getAll().then(cfg => {
      setUrl(cfg.webdav_url ?? '')
      setUsername(cfg.webdav_username ?? '')
      setPassword(cfg.webdav_password ?? '')
      setLastSync(cfg.last_sync_at ?? '')
    })
  }, [])

  const clearStatus = () => setTimeout(() => setStatus(''), 3000)

  const handleSave = async () => {
    await syncConfigOps.set('webdav_url', url)
    await syncConfigOps.set('webdav_username', username)
    await syncConfigOps.set('webdav_password', password)
    setStatus('✅ 配置已保存')
    clearStatus()
  }

  const handleUpload = async () => {
    try {
      setStatus('上传中…')
      await uploadBackup({ url, username, password })
      setLastSync(new Date().toISOString())
      setStatus('✅ 上传成功')
    } catch (e) {
      setStatus(`❌ ${(e as Error).message}`)
    }
    clearStatus()
  }

  const handleDownload = async () => {
    try {
      setStatus('下载中…')
      const r = await downloadAndMerge({ url, username, password })
      setLastSync(new Date().toISOString())
      setStatus(`✅ 同步完成：新增 ${r.added}，更新 ${r.updated}`)
    } catch (e) {
      setStatus(`❌ ${(e as Error).message}`)
    }
    clearStatus()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-input-bg)',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--color-text)',
    marginBottom: 8,
    outline: 'none',
  }

  const btn = (primary?: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    background: primary ? 'var(--color-tab-active)' : 'var(--color-bg-secondary)',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    color: primary ? 'var(--color-fab-text)' : 'var(--color-text)',
    cursor: 'pointer',
  })

  return (
    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 12 }}>WebDAV 云同步</div>
      <input style={inputStyle} placeholder="服务器地址 https://dav.example.com" value={url} onChange={e => setUrl(e.target.value)} />
      <input style={inputStyle} placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} />
      <input style={{ ...inputStyle, marginBottom: 12 }} type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleSave} style={{ ...btn(true), width: '100%', marginBottom: 8 }}>保存配置</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleUpload} style={btn()}>上传备份</button>
        <button onClick={handleDownload} style={btn()}>下载恢复</button>
      </div>
      {lastSync && (
        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 8 }}>
          上次同步：{new Date(lastSync).toLocaleString('zh-CN')}
        </div>
      )}
      {status && (
        <div style={{ fontSize: 12, color: 'var(--color-text)', marginTop: 8, fontWeight: 600 }}>
          {status}
        </div>
      )}
    </div>
  )
}

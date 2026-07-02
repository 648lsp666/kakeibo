import { WebDAVConfig } from '../components/settings/WebDAVConfig'
import { DataManager } from '../components/settings/DataManager'

export function SettingsPage() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)', marginBottom: 16 }}>设置</div>
      <WebDAVConfig />
      <DataManager />
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 24 }}>
        Kakeibo v0.1.0
      </div>
    </div>
  )
}

import { WebDAVConfig } from '../components/settings/WebDAVConfig'
import { DataManager } from '../components/settings/DataManager'
import { CloudSyncCard } from '../components/settings/CloudSyncCard'

export function SettingsPage() {
  return (
    <div className="page-scroll" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--color-text)', fontSize: 24, fontWeight: 900 }}>设置</h1>
        <p style={{ color: 'var(--color-text-small)', fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>
          管理自动同步、手动灾备和本地数据。
        </p>
      </header>
      <section aria-labelledby="sync-settings-title">
        <h2 id="sync-settings-title" style={sectionTitle}>同步与备份</h2>
        <CloudSyncCard />
        <div className="surface" style={{ marginTop: 14, padding: 16 }}>
          <WebDAVConfig />
        </div>
      </section>
      <section className="surface" aria-labelledby="data-settings-title" style={{ marginTop: 14, padding: 16 }}>
        <h2 id="data-settings-title" style={sectionTitle}>数据管理</h2>
        <DataManager />
      </section>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-small)', marginTop: 24 }}>
        Kakeibo v0.1.0
      </div>
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  color: 'var(--color-text)', fontSize: 16, fontWeight: 800, marginBottom: 14,
}

import { useAppStore } from './store/appStore'
import { TabBar } from './components/layout/TabBar'
import { LedgerPage } from './pages/LedgerPage'
import { StatsPage } from './pages/StatsPage'
import { CategoryPage } from './pages/CategoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { AddSheet } from './components/entry/AddSheet'
import './index.css'
import { AuthSyncProvider, useAuthSync } from './sync/auth-session'
import { CloudSyncCard } from './components/settings/CloudSyncCard'
import { motion } from 'framer-motion'

export default function App() {
  return (
    <AuthSyncProvider>
      <AppContent />
    </AuthSyncProvider>
  )
}

function AppContent() {
  const { activeTab } = useAppStore()
  const auth = useAuthSync()
  const activePage = activeTab === 'ledger' ? <LedgerPage />
    : activeTab === 'stats' ? <StatsPage />
      : activeTab === 'category' ? <CategoryPage />
        : <SettingsPage />

  if (auth.loading || auth.migrationRequired) {
    return (
      <div className="app-shell" style={shellStyle}>
        <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ margin: '12vh auto 0', maxWidth: 390 }}>
            {auth.migrationRequired
              ? <CloudSyncCard />
              : (
                <>
                  <div className="surface" role="status" style={{ color: 'var(--color-text)', padding: 20, textAlign: 'center' }}>
                    正在准备本地账本…
                  </div>
                  {auth.session && <div style={{ marginTop: 14 }}><CloudSyncCard /></div>}
                </>
              )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell" style={shellStyle}>
      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingBottom: 'calc(90px + env(safe-area-inset-bottom))' }}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
          style={{ height: '100%', minHeight: 0 }}
        >
          {activePage}
        </motion.div>
      </main>
      <TabBar />
      <AddSheet />
    </div>
  )
}

const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
  height: '100dvh',
  maxWidth: '430px',
  margin: '0 auto',
  background: 'var(--color-bg)',
  overflow: 'hidden',
  position: 'relative',
}

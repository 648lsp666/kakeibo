import { useAppStore } from './store/appStore'
import { TabBar } from './components/layout/TabBar'
import { LedgerPage } from './pages/LedgerPage'
import { StatsPage } from './pages/StatsPage'
import { CategoryPage } from './pages/CategoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { AddSheet } from './components/entry/AddSheet'
import './index.css'

export default function App() {
  const { activeTab } = useAppStore()

  return (
    <div className="app-shell" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      height: '100dvh',
      maxWidth: '430px',
      margin: '0 auto',
      background: 'var(--color-bg)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingBottom: 'calc(90px + env(safe-area-inset-bottom))' }}>
        {activeTab === 'ledger'   && <LedgerPage />}
        {activeTab === 'stats'    && <StatsPage />}
        {activeTab === 'category' && <CategoryPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
      <TabBar />
      <AddSheet />
    </div>
  )
}

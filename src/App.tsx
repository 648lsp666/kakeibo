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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxWidth: '430px',
      margin: '0 auto',
      background: 'var(--color-bg)',
    }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'ledger'   && <LedgerPage />}
        {activeTab === 'stats'    && <StatsPage />}
        {activeTab === 'category' && <CategoryPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </div>
      <TabBar />
      <AddSheet />
    </div>
  )
}

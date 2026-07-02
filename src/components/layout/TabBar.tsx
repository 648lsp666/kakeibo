import { useAppStore, type TabName } from '../../store/appStore'

const TABS: { id: TabName; emoji: string; label: string }[] = [
  { id: 'ledger',   emoji: '📒', label: '账单' },
  { id: 'stats',    emoji: '📊', label: '统计' },
  { id: 'category', emoji: '🏷️', label: '分类' },
  { id: 'settings', emoji: '⚙️', label: '设置' },
]

export function TabBar() {
  const { activeTab, setActiveTab, openAddSheet } = useAppStore()

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '8px 4px 12px',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
    }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <span style={{ fontSize: '22px' }}>{tab.emoji}</span>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: activeTab === tab.id ? 'var(--color-tab-active)' : 'var(--color-tab-inactive)',
          }}>
            {tab.label}
          </span>
        </button>
      ))}
      <button
        onClick={openAddSheet}
        style={{
          width: '48px', height: '48px',
          borderRadius: '50%',
          background: 'var(--color-fab-bg)',
          color: 'var(--color-fab-text)',
          border: 'none',
          fontSize: '26px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}
      >
        +
      </button>
    </div>
  )
}

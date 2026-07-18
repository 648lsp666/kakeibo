import { useAppStore, type TabName } from '../../store/appStore'
import { Icon, type IconName } from '../ui/Icon'

const TABS: { id: TabName; icon: IconName; label: string }[] = [
  { id: 'ledger', icon: 'ledger', label: '账单' },
  { id: 'stats', icon: 'chart', label: '统计' },
  { id: 'category', icon: 'category', label: '分类' },
  { id: 'settings', icon: 'settings', label: '设置' },
]

export function TabBar() {
  const { activeTab, setActiveTab, openAddSheet } = useAppStore()

  return (
    <nav aria-label="主导航" className="tab-bar surface" style={{
      position: 'absolute',
      zIndex: 20,
      left: 12,
      right: 12,
      bottom: 'max(12px, env(safe-area-inset-bottom))',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 66,
      padding: '7px 8px',
      borderRadius: 24,
      boxShadow: 'var(--shadow-card)',
    }}>
      {TABS.slice(0, 2).map(tab => (
        <button
          key={tab.id}
          type="button"
          className="tab-button"
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          onClick={() => setActiveTab(tab.id)}
          style={{
            flex: 1,
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: 'none',
            border: 'none',
            borderRadius: 14,
            cursor: 'pointer',
            padding: '3px 0',
            color: activeTab === tab.id ? 'var(--color-primary-strong)' : 'var(--color-text-small)',
          }}
        >
          <Icon name={tab.icon} size={20} />
          <span aria-hidden="true" style={{ fontSize: 10, fontWeight: 700 }}>
            {tab.label}
          </span>
        </button>
      ))}
      <button
        type="button"
        className="tab-button"
        aria-label="记一笔"
        onClick={openAddSheet}
        style={{
          width: 52, height: 52,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'var(--shadow-fab)',
          margin: '-18px 6px 0',
        }}
      >
        <Icon name="plus" size={24} />
      </button>
      {TABS.slice(2).map(tab => (
        <button
          key={tab.id}
          type="button"
          className="tab-button"
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          onClick={() => setActiveTab(tab.id)}
          style={{
            flex: 1,
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            background: 'none',
            border: 'none',
            borderRadius: 14,
            cursor: 'pointer',
            padding: '3px 0',
            color: activeTab === tab.id ? 'var(--color-primary-strong)' : 'var(--color-text-small)',
          }}
        >
          <Icon name={tab.icon} size={20} />
          <span aria-hidden="true" style={{ fontSize: 10, fontWeight: 700 }}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

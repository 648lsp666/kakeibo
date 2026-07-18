# Shared layouts

## `src/App.tsx` — App shell

```tsx
export default function App() {
  return <AuthSyncProvider><AppContent /></AuthSyncProvider>
}
function AppContent() {
  const { activeTab } = useAppStore()
  return (
    <div className="app-shell" style={{ display:'flex', flexDirection:'column', minHeight:'100dvh', height:'100dvh', maxWidth:430, margin:'0 auto', background:'var(--color-bg)', overflow:'hidden', position:'relative' }}>
      <SyncStatusPill />
      <main style={{ flex:1, minHeight:0, overflow:'hidden', paddingBottom:'calc(90px + env(safe-area-inset-bottom))' }}>
        {activeTab === 'ledger' && <LedgerPage />}
        {activeTab === 'stats' && <StatsPage />}
        {activeTab === 'category' && <CategoryPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
      <TabBar />
      <AddSheet />
    </div>
  )
}
```

## `src/components/layout/TabBar.tsx` — Floating bottom navigation

```tsx
const TABS = [
  { id:'ledger', icon:'ledger', label:'账单' }, { id:'stats', icon:'chart', label:'统计' },
  { id:'category', icon:'category', label:'分类' }, { id:'settings', icon:'settings', label:'设置' },
]
export function TabBar() {
  const { activeTab, setActiveTab, openAddSheet } = useAppStore()
  return <nav aria-label="主导航" className="tab-bar surface" style={{ position:'absolute', zIndex:20, left:12, right:12, bottom:'max(12px, env(safe-area-inset-bottom))', display:'flex', justifyContent:'space-between', alignItems:'center', minHeight:66, padding:'7px 8px', borderRadius:24, boxShadow:'var(--shadow-card)' }}>
    {TABS.slice(0,2).map(tab => <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} />)}
    <button aria-label="记一笔" onClick={openAddSheet} style={{ width:52, height:52, borderRadius:'50%', background:'var(--color-primary)', color:'var(--color-on-primary)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--shadow-fab)', margin:'-18px 6px 0' }}><Icon name="plus" size={24}/></button>
    {TABS.slice(2).map(tab => <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} />)}
  </nav>
}
```

Full navigation source: `src/components/layout/TabBar.tsx`. Global floating sync pill: `src/components/sync/SyncStatusPill.tsx`.

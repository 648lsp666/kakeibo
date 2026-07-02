import { create } from 'zustand'

export type TabName = 'ledger' | 'stats' | 'category' | 'settings'

interface AppState {
  activeTab: TabName
  isAddSheetOpen: boolean
  currentMonth: string   // 'YYYY-MM'
  refreshSignal: number
  setActiveTab: (tab: TabName) => void
  openAddSheet: () => void
  closeAddSheet: () => void
  setCurrentMonth: (month: string) => void
  triggerRefresh: () => void
}

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'ledger',
  isAddSheetOpen: false,
  currentMonth: currentMonth(),
  refreshSignal: 0,
  setActiveTab: (tab) => set({ activeTab: tab }),
  openAddSheet: () => set({ isAddSheetOpen: true }),
  closeAddSheet: () => set({ isAddSheetOpen: false }),
  setCurrentMonth: (month) => set({ currentMonth: month }),
  triggerRefresh: () => set(s => ({ refreshSignal: s.refreshSignal + 1 })),
}))

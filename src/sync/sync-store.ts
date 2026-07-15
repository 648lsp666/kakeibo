import { create } from 'zustand'
import type { SyncStatus } from './contracts'

interface SyncStore {
  status: SyncStatus
  setStatus(status: SyncStatus): void
}

export const useSyncStore = create<SyncStore>(set => ({
  status: { kind: 'local-only' },
  setStatus: status => set({ status }),
}))

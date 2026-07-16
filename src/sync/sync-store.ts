import { create } from 'zustand'
import type { SyncStatus } from './contracts'

interface SyncStore {
  status: SyncStatus
  isolated: number
  isolatedReason?: string
  setStatus(status: SyncStatus): void
  setIsolated(count: number, reason?: string): void
}

export const useSyncStore = create<SyncStore>(set => ({
  status: { kind: 'local-only' },
  isolated: 0,
  setStatus: status => set({ status }),
  setIsolated: (isolated, isolatedReason) => set({ isolated, isolatedReason }),
}))

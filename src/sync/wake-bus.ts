export type SyncWakeReason = 'local-write' | 'realtime' | 'online' | 'foreground' | 'manual'

const listeners = new Set<(reason: SyncWakeReason) => void>()

export function emitSyncWake(reason: SyncWakeReason): void {
  for (const listener of listeners) listener(reason)
}

export function subscribeSyncWake(listener: (reason: SyncWakeReason) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

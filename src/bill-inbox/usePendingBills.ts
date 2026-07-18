import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSync } from '../sync/auth-session'
import { getSupabaseClientIfConfigured } from '../sync/supabase-client'
import { createBillInboxClient } from './client'
import type { BillCompletion, PendingBill } from './types'

export function usePendingBills() {
  const { session, loading: authLoading, migrationRequired } = useAuthSync()
  const [bills, setBills] = useState<PendingBill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const client = useMemo(() => {
    const supabase = getSupabaseClientIfConfigured()
    const domain = import.meta.env.VITE_INBOUND_EMAIL_DOMAIN?.trim()
    if (!session || !supabase || !domain || authLoading || migrationRequired) return null
    try {
      return createBillInboxClient(supabase, session.user.id, domain)
    } catch {
      return null
    }
  }, [authLoading, migrationRequired, session])

  const refresh = useCallback(async () => {
    if (!client) {
      setBills([])
      return
    }
    setLoading(true)
    setError('')
    try {
      setBills(await client.list())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '待处理账单加载失败')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (!client) {
      setBills([])
      setError('')
      return
    }
    void refresh()
    const unsubscribe = client.subscribe(() => { void refresh() })
    const wake = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
    }
  }, [client, refresh])

  const remove = useCallback(async (billId: string) => {
    if (!client) throw new Error('请先登录云同步账号')
    await client.delete(billId)
    await refresh()
  }, [client, refresh])

  const download = useCallback(async (bill: PendingBill) => {
    if (!client) throw new Error('请先登录云同步账号')
    return client.download(bill)
  }, [client])

  const complete = useCallback(async (billId: string, completion: BillCompletion) => {
    if (!client) throw new Error('请先登录云同步账号')
    await client.complete(billId, completion)
    await refresh()
  }, [client, refresh])

  return { bills, loading, error, refresh, download, remove, complete }
}

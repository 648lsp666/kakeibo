import { transactionOps, categoryOps, syncConfigOps } from './db'
import { domainRepository } from '../sync/domain-repository'

export interface WebDAVCredentials {
  url: string
  username: string
  password: string
}

async function davFetch(creds: WebDAVCredentials, path: string, options: RequestInit = {}) {
  const fullUrl = creds.url.replace(/\/$/, '') + path
  const auth = btoa(`${creds.username}:${creds.password}`)
  return fetch(fullUrl, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      ...options.headers,
    },
  })
}

export async function uploadBackup(creds: WebDAVCredentials): Promise<void> {
  const [transactions, categories] = await Promise.all([
    transactionOps.getAll(),
    categoryOps.list(),
  ])
  const payload = JSON.stringify(
    { transactions, categories, exportedAt: new Date().toISOString() },
    null,
    2
  )
  const res = await davFetch(creds, '/kakeibo-data.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
  if (!res.ok) throw new Error(`上传失败：${res.status} ${res.statusText}`)
  await syncConfigOps.set('last_sync_at', new Date().toISOString())
}

export async function downloadAndMerge(creds: WebDAVCredentials): Promise<{ added: number; updated: number }> {
  const res = await davFetch(creds, '/kakeibo-data.json')
  if (res.status === 404) throw new Error('远端暂无备份文件')
  if (!res.ok) throw new Error(`下载失败：${res.status} ${res.statusText}`)

  const data = await res.json() as { transactions: any[]; categories: any[] }
  let added = 0, updated = 0

  const local = await domainRepository.exportSnapshot()
  const localMap = Object.fromEntries(local.transactions.map(t => [t.id, t]))
  const addedRecords = []

  for (const tx of data.transactions ?? []) {
    const existing = localMap[tx.id]
    if (!existing) {
      addedRecords.push(tx)
      added++
    } else if (tx.updatedAt > existing.updatedAt) {
      await domainRepository.upsert('transaction', tx)
      updated++
    }
  }

  if (addedRecords.length > 0) await domainRepository.importTransactions(addedRecords)

  await syncConfigOps.set('last_sync_at', new Date().toISOString())
  return { added, updated }
}

import { transactionOps, categoryOps, syncConfigOps } from './db'
import { getWorkspaceSnapshot, importAnonymousWebDavTransactions } from '../sync/local-db'

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
  const workspace = await getWorkspaceSnapshot()
  if (workspace.id.kind !== 'anonymous') {
    throw new Error('请先退出账号并在本机模式恢复 WebDAV 备份')
  }

  const res = await davFetch(creds, '/kakeibo-data.json')
  if (res.status === 404) throw new Error('远端暂无备份文件')
  if (!res.ok) throw new Error(`下载失败：${res.status} ${res.statusText}`)

  const data = await res.json() as { transactions?: Parameters<typeof importAnonymousWebDavTransactions>[0] }
  const result = await importAnonymousWebDavTransactions(data.transactions ?? [])

  await syncConfigOps.set('last_sync_at', new Date().toISOString())
  return result
}

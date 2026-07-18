import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import App from './App'

const mocks = vi.hoisted(() => ({
  auth: { loading: true, migrationRequired: false } as any,
  mounts: 0,
  unmounts: 0,
}))

vi.mock('./sync/auth-session', () => ({
  AuthSyncProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthSync: () => mocks.auth,
}))
vi.mock('./pages/LedgerPage', () => ({ LedgerPage: () => {
  useEffect(() => {
    mocks.mounts++
    return () => { mocks.unmounts++ }
  }, [])
  return <div>账本工作区</div>
} }))
vi.mock('./pages/StatsPage', () => ({ StatsPage: () => <div>统计工作区</div> }))
vi.mock('./pages/CategoryPage', () => ({ CategoryPage: () => <div>分类工作区</div> }))
vi.mock('./pages/SettingsPage', () => ({ SettingsPage: () => <div>设置工作区</div> }))
vi.mock('./components/layout/TabBar', () => ({ TabBar: () => <div>导航栏</div> }))
vi.mock('./components/entry/AddSheet', () => ({ AddSheet: () => <div>新增账单</div> }))
vi.mock('./components/settings/CloudSyncCard', () => ({ CloudSyncCard: () => <div>迁移账号卡片</div> }))
vi.mock('./components/sync/SyncStatusPill', () => ({ SyncStatusPill: () => <div>全局同步提示</div> }))

beforeEach(() => {
  mocks.auth = { loading: true, migrationRequired: false }
  mocks.mounts = 0
  mocks.unmounts = 0
})

it('does not mount workspace UI while auth is preparing and mounts it only when ready', () => {
  const view = render(<App />)

  expect(screen.queryByText('账本工作区')).not.toBeInTheDocument()
  expect(screen.queryByText('新增账单')).not.toBeInTheDocument()
  expect(screen.getByText('正在准备本地账本…')).toBeInTheDocument()

  mocks.auth = { loading: false, migrationRequired: false }
  view.rerender(<App />)

  expect(screen.getByText('账本工作区')).toBeInTheDocument()
  expect(screen.getByText('新增账单')).toBeInTheDocument()
  expect(mocks.mounts).toBe(1)
})

it('unmounts workspace UI during migration and exposes only the explicit migration card', () => {
  mocks.auth = { loading: false, migrationRequired: false }
  const view = render(<App />)
  expect(screen.getByText('账本工作区')).toBeInTheDocument()

  mocks.auth = { loading: false, migrationRequired: true }
  view.rerender(<App />)

  expect(screen.queryByText('账本工作区')).not.toBeInTheDocument()
  expect(screen.queryByText('新增账单')).not.toBeInTheDocument()
  expect(screen.getByText('迁移账号卡片')).toBeInTheDocument()
  expect(mocks.unmounts).toBe(1)
})

it('does not mount a global sync status overlay in the workspace', () => {
  mocks.auth = { loading: false, migrationRequired: false }

  render(<App />)

  expect(screen.queryByText('全局同步提示')).not.toBeInTheDocument()
})

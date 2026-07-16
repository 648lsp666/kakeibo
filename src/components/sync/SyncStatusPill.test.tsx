import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncStatusPill } from './SyncStatusPill'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  status: { kind: 'local-only' } as any,
}))

vi.mock('../../sync/auth-session', () => ({
  useAuthSync: () => ({ session: mocks.session }),
}))
vi.mock('../../sync/sync-store', () => ({
  useSyncStore: (selector: (state: any) => unknown) => selector({ status: mocks.status }),
}))

describe('SyncStatusPill', () => {
  beforeEach(() => {
    mocks.session = { user: { id: 'user-1' } }
    mocks.status = { kind: 'local-only' }
  })

  it.each([
    [{ kind: 'idle' }, '已同步'],
    [{ kind: 'syncing', pending: 3 }, '同步中 · 3 项'],
    [{ kind: 'offline', pending: 2 }, '离线 · 2 项待同步'],
    [{ kind: 'auth-required', pending: 1 }, '需要重新登录'],
    [{ kind: 'error', pending: 1, message: '服务器暂时不可用' }, '同步失败'],
    [{ kind: 'local-only' }, '仅保存在本机'],
  ])('maps %j to the exact calm status copy', (status, copy) => {
    mocks.status = status

    render(<SyncStatusPill />)

    expect(screen.getByRole('status')).toHaveTextContent(copy)
    expect(screen.getByRole('status')).toHaveTextContent(new RegExp(`^${copy}$`))
  })

  it('keeps errors in a single non-toast status surface', () => {
    mocks.status = { kind: 'error', pending: 2, message: '服务器暂时不可用' }

    const view = render(<SyncStatusPill />)
    view.rerender(<SyncStatusPill />)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('服务器暂时不可用')).not.toBeInTheDocument()
  })

  it('stays hidden for normal signed-out local-only use', () => {
    mocks.session = null
    mocks.status = { kind: 'local-only' }

    render(<SyncStatusPill />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each([
    { kind: 'offline', pending: 2 },
    { kind: 'auth-required', pending: 2 },
    { kind: 'error', pending: 2, message: '服务器暂时不可用' },
  ])('shows actionable signed-out $kind state', status => {
    mocks.session = null
    mocks.status = status

    render(<SyncStatusPill />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

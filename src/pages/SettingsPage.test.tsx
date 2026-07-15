import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'

vi.mock('../components/settings/CloudSyncCard', () => ({ CloudSyncCard: () => <div>账号自动同步</div> }))
vi.mock('../components/settings/WebDAVConfig', () => ({ WebDAVConfig: () => <div>手动 WebDAV 备份</div> }))
vi.mock('../components/settings/DataManager', () => ({ DataManager: () => <div>数据管理内容</div> }))

it('places automatic account sync above manual WebDAV backup', () => {
  render(<SettingsPage />)

  const account = screen.getByText('账号自动同步')
  const webdav = screen.getByText('手动 WebDAV 备份')
  expect(account.compareDocumentPosition(webdav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

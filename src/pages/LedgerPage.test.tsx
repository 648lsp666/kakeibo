import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Transaction } from '../types'
import { useAppStore } from '../store/appStore'
import { LedgerPage } from './LedgerPage'

const transaction: Transaction = {
  id: 'import-1',
  amount: 12,
  type: 'expense',
  categoryId: 'sys-food',
  note: '咖啡',
  date: '2026-07-15',
  source: 'wechat',
  createdAt: '2026-07-15T12:00:00.000Z',
  updatedAt: '2026-07-15T12:00:00.000Z',
}

const { importTransactions, getAll } = vi.hoisted(() => ({
  importTransactions: vi.fn(),
  getAll: vi.fn(),
}))

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [],
    summary: { income: 0, expense: 0, balance: 0 },
    deleteTransaction: vi.fn(),
    importTransactions,
  }),
}))

vi.mock('../hooks/useCategories', () => ({ useCategories: () => ({ categories: [] }) }))
vi.mock('../lib/db', () => ({ transactionOps: { getAll } }))
vi.mock('../components/import/CSVImportButton', () => ({
  CSVImportButton: ({ onParsed }: { onParsed: (transactions: Transaction[], source: 'wechat') => void }) => (
    <button type="button" onClick={() => onParsed([transaction], 'wechat')}>选择测试账单</button>
  ),
}))

beforeEach(() => {
  importTransactions.mockReset()
  getAll.mockReset().mockResolvedValue([])
  useAppStore.setState({ currentMonth: '2026-07' })
})

it('keeps the preview open and clears busy state when persistence fails', async () => {
  importTransactions.mockRejectedValueOnce(new Error('database unavailable'))
  const user = userEvent.setup()
  render(<LedgerPage />)

  await user.click(screen.getByRole('button', { name: '选择测试账单' }))
  await user.click(await screen.findByRole('button', { name: '确认导入 1 条' }))

  const dialog = screen.getByRole('dialog', { name: '微信账单预览' })
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('导入失败：database unavailable')
  await waitFor(() => expect(screen.getByRole('button', { name: '确认导入 1 条' })).toBeEnabled())
})

it('clears the preview only after a successful import', async () => {
  importTransactions.mockResolvedValueOnce({ added: 1, skipped: 0 })
  const user = userEvent.setup()
  render(<LedgerPage />)

  await user.click(screen.getByRole('button', { name: '选择测试账单' }))
  await user.click(await screen.findByRole('button', { name: '确认导入 1 条' }))

  expect(await screen.findByRole('status')).toHaveTextContent('导入完成：新增 1 条，跳过重复 0 条')
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '微信账单预览' })).not.toBeInTheDocument())
})

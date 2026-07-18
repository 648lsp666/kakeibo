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

const { importTransactions, getAll, completePending } = vi.hoisted(() => ({
  importTransactions: vi.fn(),
  getAll: vi.fn(),
  completePending: vi.fn(),
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
vi.mock('../components/import/PendingBillsCard', () => ({
  PendingBillsCard: ({ onParsed }: { onParsed: (...args: any[]) => void }) => (
    <button type="button" onClick={() => onParsed(
      { source: 'wechat', transactions: [transaction] },
      { id: 'pending-bill-1', filename: 'wechat.zip' },
      completePending,
    )}>选择邮件测试账单</button>
  ),
}))

beforeEach(() => {
  importTransactions.mockReset()
  getAll.mockReset().mockResolvedValue([])
  completePending.mockReset().mockResolvedValue(undefined)
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

it('completes and deletes a pending attachment only after its transactions import', async () => {
  importTransactions.mockResolvedValueOnce({ added: 1, skipped: 0 })
  const user = userEvent.setup()
  render(<LedgerPage />)

  await user.click(screen.getByRole('button', { name: '选择邮件测试账单' }))
  await user.click(await screen.findByRole('button', { name: '确认导入 1 条' }))

  await waitFor(() => expect(completePending).toHaveBeenCalledWith({
    source: 'wechat', statementPeriod: '2026-07', importedCount: 1,
  }))
  expect(importTransactions.mock.invocationCallOrder[0]).toBeLessThan(completePending.mock.invocationCallOrder[0])
})

it('keeps the pending attachment when transaction import fails', async () => {
  importTransactions.mockRejectedValueOnce(new Error('database unavailable'))
  const user = userEvent.setup()
  render(<LedgerPage />)

  await user.click(screen.getByRole('button', { name: '选择邮件测试账单' }))
  await user.click(await screen.findByRole('button', { name: '确认导入 1 条' }))

  await screen.findByText('导入失败：database unavailable')
  expect(completePending).not.toHaveBeenCalled()
})

it('keeps the preview retryable when attachment cleanup fails after import', async () => {
  importTransactions.mockResolvedValueOnce({ added: 1, skipped: 0 })
  completePending.mockRejectedValueOnce(new Error('cleanup unavailable'))
  const user = userEvent.setup()
  render(<LedgerPage />)

  await user.click(screen.getByRole('button', { name: '选择邮件测试账单' }))
  await user.click(await screen.findByRole('button', { name: '确认导入 1 条' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('导入失败：cleanup unavailable')
  expect(screen.getByRole('dialog', { name: '微信账单预览' })).toBeInTheDocument()
})

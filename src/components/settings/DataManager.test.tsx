import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { seedCategories } from '../../lib/seed'
import { DataManager } from './DataManager'

const mocks = vi.hoisted(() => ({ removeAllTransactions: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../lib/db', () => ({
  transactionOps: { getAll: vi.fn().mockResolvedValue([]) },
  categoryOps: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../lib/seed', () => ({ seedCategories: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../sync/domain-repository', () => ({
  domainRepository: { removeAllTransactions: mocks.removeAllTransactions },
}))

it('clears transactions only after custom confirmation', async () => {
  render(<DataManager />)
  await userEvent.click(screen.getByRole('button', { name: '清除所有账单记录' }))
  expect(mocks.removeAllTransactions).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '确认清除' }))
  expect(mocks.removeAllTransactions).toHaveBeenCalledOnce()
  expect(seedCategories).toHaveBeenCalledOnce()
})

it('uses contrast-safe text on the destructive action', () => {
  render(<DataManager />)
  expect(screen.getByRole('button', { name: '清除所有账单记录' })).toHaveStyle({
    background: 'var(--color-danger-soft)',
    color: 'var(--color-expense-text)',
  })
})

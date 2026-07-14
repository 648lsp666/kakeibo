import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { seedCategories } from '../../lib/seed'
import { DataManager } from './DataManager'

const mocks = vi.hoisted(() => ({ clear: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({ clear: mocks.clear }),
  transactionOps: { getAll: vi.fn().mockResolvedValue([]) },
  categoryOps: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../lib/seed', () => ({ seedCategories: vi.fn().mockResolvedValue(undefined) }))

it('clears transactions only after custom confirmation', async () => {
  render(<DataManager />)
  await userEvent.click(screen.getByRole('button', { name: '清除所有账单记录' }))
  expect(mocks.clear).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: '确认清除' }))
  expect(mocks.clear).toHaveBeenCalledWith('transactions')
  expect(seedCategories).toHaveBeenCalledOnce()
})

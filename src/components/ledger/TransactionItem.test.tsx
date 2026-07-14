import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Transaction } from '../../types'
import { TransactionItem } from './TransactionItem'

const transaction: Transaction = {
  id: 'tx-1',
  amount: 25,
  type: 'expense',
  categoryId: 'food',
  note: '午餐',
  date: '2026-07-15',
  source: 'manual',
  createdAt: '2026-07-15T12:00:00.000Z',
  updatedAt: '2026-07-15T12:00:00.000Z',
}

it('fills the 72px swipe reveal area with the delete target', () => {
  render(<TransactionItem tx={transaction} onDelete={vi.fn()} />)

  expect(screen.getByRole('button', { name: '删除记录' })).toHaveStyle({
    width: '100%',
    height: '100%',
  })
})

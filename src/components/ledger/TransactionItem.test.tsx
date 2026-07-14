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

  const deleteButton = screen.getByRole('button', { name: '删除记录' })
  expect(deleteButton).toHaveStyle({
    width: '100%',
    height: '100%',
    color: 'var(--color-on-danger)',
  })
  expect(deleteButton.parentElement).toHaveStyle({ background: 'var(--color-expense)' })
})

it('uses centralized semantic tokens for imported source badges', () => {
  render(<TransactionItem tx={{ ...transaction, source: 'alipay' }} onDelete={vi.fn()} />)

  expect(screen.getByText('支付宝')).toHaveStyle({
    background: 'var(--color-source-alipay-soft)',
    color: 'var(--color-source-alipay)',
  })
})

it('uses the contrast-safe small-text token for a manual source badge', () => {
  render(<TransactionItem tx={transaction} onDelete={vi.fn()} />)

  expect(screen.getByText('手动')).toHaveStyle({ color: 'var(--color-text-small)' })
})

import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ComponentPropsWithoutRef } from 'react'
import type { Transaction } from '../../types'
import { TransactionList } from './TransactionList'

const motionPreference = vi.hoisted(() => ({ reduced: false }))

vi.mock('framer-motion', () => ({
  useReducedMotion: () => motionPreference.reduced,
  motion: {
    li: ({ initial, transition, ...props }: ComponentPropsWithoutRef<'li'> & { initial?: unknown; transition?: unknown }) => (
      <li
        data-initial={JSON.stringify(initial)}
        data-transition={JSON.stringify(transition)}
        {...props}
      />
    ),
  },
}))

vi.mock('./DateGroup', () => ({
  DateGroup: () => <span>交易分组</span>,
}))

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

beforeEach(() => {
  motionPreference.reduced = false
})

it('removes entrance movement, delay, and transition when reduced motion is preferred', () => {
  motionPreference.reduced = true
  render(<TransactionList transactions={[transaction]} categories={[]} onDelete={vi.fn()} />)

  const group = screen.getByText('交易分组').closest('li')
  expect(group).toHaveAttribute('data-initial', 'false')
  expect(group).not.toHaveAttribute('data-transition')
})

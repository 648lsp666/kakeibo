import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { DailyGroup } from '../../types'
import { DateGroup } from './DateGroup'

const group: DailyGroup = {
  date: '2026-07-15',
  total: -25,
  transactions: [],
}

it('uses semantic text tokens for negative and positive daily totals', () => {
  const { rerender } = render(<DateGroup group={group} categories={[]} onDelete={vi.fn()} />)
  expect(screen.getByText('¥25.00')).toHaveStyle({ color: 'var(--color-expense-text)' })

  rerender(<DateGroup group={{ ...group, total: 25 }} categories={[]} onDelete={vi.fn()} />)
  expect(screen.getByText('+¥25.00')).toHaveStyle({ color: 'var(--color-income-text)' })
})

it('uses the contrast-safe secondary token for the date heading', () => {
  render(<DateGroup group={group} categories={[]} onDelete={vi.fn()} />)

  expect(screen.getByRole('heading', { level: 2 })).toHaveStyle({
    color: 'var(--color-text-secondary)',
  })
})

it('does not display an expense category on an income transaction', () => {
  render(
    <DateGroup
      group={{
        ...group,
        total: 9.9,
        transactions: [{
          id: 'income-1', amount: 9.9, type: 'income', categoryId: 'sys-shop', note: '京东商城平台商户',
          date: group.date, source: 'wechat', createdAt: '', updatedAt: '',
        }],
      }}
      categories={[
        { id: 'sys-shop', name: '购物', icon: 'cart', type: 'expense', isSystem: true, sortOrder: 1, createdAt: '' },
        { id: 'sys-other-in', name: '其他收入', icon: 'gift', type: 'income', isSystem: true, sortOrder: 12, createdAt: '' },
      ]}
      onDelete={vi.fn()}
    />,
  )

  expect(screen.getByText('其他收入')).toBeInTheDocument()
  expect(screen.queryByText('购物')).not.toBeInTheDocument()
})

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

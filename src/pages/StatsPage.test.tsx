import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '../store/appStore'
import { StatsPage } from './StatsPage'

vi.mock('../hooks/useStats', () => ({
  useStats: () => ({
    categoryStats: [{ categoryId: 'food', amount: 128.5, pct: 1 }],
    merchantStats: [],
    monthlyTrend: [{ yearMonth: '2026-07', monthLabel: '7月', expense: 128.5, income: 500 }],
    totalExpense: 128.5,
    totalIncome: 500,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [{ id: 'food', name: '餐饮', emoji: '🍜' }],
  }),
}))

vi.mock('../hooks/useBudget', () => ({
  useBudget: () => ({
    rules: [],
    statuses: [],
    monthlyBudgetAmount: 100,
    addRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  }),
}))

beforeEach(() => {
  useAppStore.setState({ currentMonth: '2026-07' })
})

it('shows the current-month summary, six-month trend, and category spending', () => {
  render(<StatsPage />)

  expect(screen.getByText('本月支出')).toBeInTheDocument()
  expect(screen.getByText('近 6 个月')).toBeInTheDocument()
  expect(screen.getByText('餐饮')).toBeInTheDocument()
  expect(screen.getAllByText('¥128.50')).not.toHaveLength(0)
})

it('uses semantic accent text tokens while preserving chart accent graphics', () => {
  render(<StatsPage />)

  expect(screen.getByText('月预算')).toHaveStyle({ color: 'var(--color-warning-text)' })
  expect(screen.getByText('超预算')).toHaveStyle({ color: 'var(--color-expense-text)' })

  const expenseSummary = screen.getByText('本月支出').nextElementSibling
  const incomeSummary = screen.getByText('本月收入').nextElementSibling
  expect(expenseSummary).toHaveStyle({ color: 'var(--color-expense-text)' })
  expect(incomeSummary).toHaveStyle({ color: 'var(--color-income-text)' })

  expect(screen.getByText('超预算').previousElementSibling).toHaveStyle({
    background: 'var(--color-expense)',
  })
  expect((screen.getByText('月预算').previousElementSibling as HTMLElement).style.borderTop)
    .toBe('1.5px dashed var(--color-warning)')
})

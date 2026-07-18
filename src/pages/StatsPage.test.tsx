import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '../store/appStore'
import { StatsPage } from './StatsPage'

vi.mock('../hooks/useStats', () => ({
  useStats: () => ({
    categoryStats: [{ categoryId: 'food', amount: 123456.78, pct: 1 }],
    merchantStats: [{ name: '这是一个非常非常长的商户名称用于验证移动端布局', amount: 123456.78, pct: 1, count: 1 }],
    monthlyTrend: [{ yearMonth: '2026-07', monthLabel: '7月', expense: 123456.78, income: 500 }],
    dailyStats: [{ date: '2026-07-14', expense: 100, income: 500, net: 400, count: 2 }],
    totalExpense: 123456.78,
    totalIncome: 500,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [{
      id: 'food', name: '餐饮', emoji: '🍜', type: 'expense', isSystem: true,
      sortOrder: 0, createdAt: '2026-07-01T00:00:00.000Z',
    }],
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

it('shows the current-month summary, compact calendar, and category spending', () => {
  render(<StatsPage />)

  expect(screen.getByLabelText('本月收支概览')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: '统计周期' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /14日，净额正/ })).toHaveTextContent('+400')
  expect(screen.getByText('餐饮')).toBeInTheDocument()
  expect(screen.getAllByText('¥123,456.78')).not.toHaveLength(0)
  expect(screen.getByRole('button', { name: '上个月' })).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
  expect(screen.getByRole('button', { name: /14日，净额正/ })).toHaveClass('calendar-day')
  expect(screen.getByRole('button', { name: /14日，净额正/ })).toHaveStyle({ minHeight: '44px' })
  expect(screen.getAllByText('+400')[0]).toHaveStyle({ fontSize: '10px' })
})

it('uses semantic accent text tokens for income and expense', () => {
  render(<StatsPage />)

  const summary = screen.getByLabelText('本月收支概览')
  const values = summary.querySelectorAll('strong')
  const expenseSummary = values[0]
  const incomeSummary = values[1]
  expect(expenseSummary).toHaveStyle({ color: 'var(--color-expense-text)' })
  expect(incomeSummary).toHaveStyle({ color: 'var(--color-income-text)' })
})

it('centers the three monthly summary metrics in equal columns', () => {
  render(<StatsPage />)

  const summary = screen.getByLabelText('本月收支概览')
  expect(summary).toHaveStyle({
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    textAlign: 'center',
  })
})

it('switches between the monthly calendar and longer trend periods', async () => {
  const user = userEvent.setup()
  render(<StatsPage />)

  expect(screen.getByLabelText('本月每日收支日历')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '6 个月' }))
  expect(await screen.findByText('近 6 个月')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '1 年' }))
  expect(await screen.findByText('近 1 年')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '1 个月' }))
  expect(await screen.findByLabelText('本月每日收支日历')).toBeInTheDocument()
})

it('constrains long merchant names so amounts retain their own column', () => {
  render(<StatsPage />)

  const merchant = screen.getByText('这是一个非常非常长的商户名称用于验证移动端布局')
  expect(merchant).toHaveStyle({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })
  expect(merchant.parentElement).toHaveStyle({ minWidth: '0' })
  const amounts = screen.getAllByText('¥123,456.78')
  const amount = amounts[amounts.length - 1]
  expect(amount).toBeInTheDocument()
  expect(amount?.parentElement).toHaveStyle({ flexShrink: '0' })
})

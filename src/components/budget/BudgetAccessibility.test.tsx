import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { RuleWithStatus } from '../../hooks/useBudget'
import { BudgetCard } from './BudgetCard'
import { BudgetSection } from './BudgetSection'
import { BudgetSetupSheet } from './BudgetSetupSheet'

vi.mock('../../hooks/useBudget', () => ({
  useBudget: () => ({
    rules: [],
    statuses: [],
    monthlyBudgetAmount: undefined,
    addRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  }),
}))

const status = (overrides: Partial<RuleWithStatus> = {}): RuleWithStatus => ({
  rule: { id: 'budget-1', amount: 100, period: 'monthly' },
  spending: 50,
  limit: 100,
  pct: 0.5,
  isOver: false,
  remaining: 50,
  label: '月预算',
  subLabel: '日均可用 ¥5 · 还剩 10 天',
  ...overrides,
})

it('keeps the budget add action on the shared 44px tap-size contract', () => {
  render(<BudgetSection />)

  expect(screen.getByRole('button', { name: '+ 添加' })).toHaveStyle({
    minHeight: 'var(--tap-size)',
  })
})

it('keeps period and custom-date controls on the shared 44px tap-size contract', async () => {
  render(<BudgetSetupSheet current={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)

  for (const name of ['月预算', '年预算', '自定义']) {
    expect(screen.getByRole('button', { name })).toHaveStyle({ minHeight: 'var(--tap-size)' })
  }

  await userEvent.click(screen.getByRole('button', { name: '自定义' }))

  expect(screen.getByLabelText('开始日期')).toHaveStyle({ minHeight: 'var(--tap-size)' })
  expect(screen.getByLabelText('结束日期')).toHaveStyle({ minHeight: 'var(--tap-size)' })
})

it('uses semantic text tokens for normal, warning, and over-budget copy', () => {
  const { rerender } = render(<BudgetCard rs={status()} onEdit={vi.fn()} />)
  expect(screen.getByText('50%')).toHaveStyle({ color: 'var(--color-primary-text)' })

  rerender(<BudgetCard rs={status({ pct: 0.8 })} onEdit={vi.fn()} />)
  expect(screen.getByText('80%')).toHaveStyle({ color: 'var(--color-warning-text)' })

  rerender(<BudgetCard rs={status({ spending: 120, pct: 1.2, isOver: true, remaining: -20, subLabel: '超支 ¥20.00' })} onEdit={vi.fn()} />)
  expect(screen.getByText('月预算 · 已超预算')).toHaveStyle({ color: 'var(--color-expense-text)' })
  expect(screen.getByText('120%')).toHaveStyle({ color: 'var(--color-expense-text)' })
  expect(screen.getByText('超支 ¥20.00')).toHaveStyle({ color: 'var(--color-expense-text)' })
})

it('uses the expense text token for the setup delete action', () => {
  render(
    <BudgetSetupSheet
      current={{ id: 'budget-1', amount: 100, period: 'monthly' }}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
    />,
  )

  const deleteButton = screen.getByRole('button', { name: '删除' })
  expect(deleteButton).toHaveStyle({ color: 'var(--color-expense-text)' })
  expect(deleteButton.style.borderColor).toBe('var(--color-expense)')
})

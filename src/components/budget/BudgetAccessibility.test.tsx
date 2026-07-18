import { render, screen, waitFor } from '@testing-library/react'
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

it('uses the semantic primary pair for the selected budget period', () => {
  render(<BudgetSetupSheet current={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)

  expect(screen.getByRole('button', { name: '月预算', pressed: true })).toHaveStyle({
    background: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
  })
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

it('focuses and describes the first invalid budget field', async () => {
  const user = userEvent.setup()
  render(<BudgetSetupSheet current={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)

  await user.click(screen.getByRole('button', { name: '保存' }))

  const amount = screen.getByLabelText('预算金额')
  expect(amount).toHaveFocus()
  expect(amount).toHaveAttribute('aria-invalid', 'true')
  expect(amount).toHaveAttribute('aria-describedby', 'budget-error')
})

it('focuses and describes the first missing custom date', async () => {
  const user = userEvent.setup()
  render(<BudgetSetupSheet current={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)

  await user.type(screen.getByLabelText('预算金额'), '1000')
  await user.click(screen.getByRole('button', { name: '自定义' }))
  await user.click(screen.getByRole('button', { name: '保存' }))

  const start = screen.getByLabelText('开始日期')
  expect(start).toHaveFocus()
  expect(start).toHaveAttribute('aria-invalid', 'true')
  expect(start).toHaveAttribute('aria-describedby', 'budget-error')
})

it('focuses the end date when the custom range is invalid', async () => {
  const user = userEvent.setup()
  render(<BudgetSetupSheet current={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)

  await user.type(screen.getByLabelText('预算金额'), '1000')
  await user.click(screen.getByRole('button', { name: '自定义' }))
  await user.type(screen.getByLabelText('开始日期'), '2026-07-20')
  await user.type(screen.getByLabelText('结束日期'), '2026-07-10')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(screen.getByLabelText('结束日期')).toHaveFocus()
  expect(screen.getByLabelText('结束日期')).toHaveAttribute('aria-invalid', 'true')
})

it('prevents duplicate saves and recovers after rejection', async () => {
  let rejectSave!: (reason: Error) => void
  const onSave = vi.fn(() => new Promise<void>((_, reject) => { rejectSave = reject }))
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<BudgetSetupSheet current={null} onSave={onSave} onDelete={vi.fn()} onClose={onClose} />)

  await user.type(screen.getByLabelText('预算金额'), '1000')
  await user.dblClick(screen.getByRole('button', { name: '保存' }))

  expect(onSave).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '取消' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled()
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')

  rejectSave(new Error('write failed'))
  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())
  expect(screen.getByRole('button', { name: '取消' })).toBeEnabled()
  expect(onClose).not.toHaveBeenCalled()
})

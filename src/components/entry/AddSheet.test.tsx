import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/appStore'
import { AddSheet } from './AddSheet'

const { addTransaction } = vi.hoisted(() => ({
  addTransaction: vi.fn(),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useTransactions: () => ({ addTransaction }),
}))

vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [
      {
        id: 'sys-food',
        name: '餐饮',
        emoji: '🍜',
        type: 'expense',
        isSystem: true,
        sortOrder: 1,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'sys-salary',
        name: '工资',
        emoji: '💰',
        type: 'income',
        isSystem: true,
        sortOrder: 2,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ],
  }),
}))

beforeEach(() => {
  addTransaction.mockReset()
  useAppStore.setState({ isAddSheetOpen: true, currentMonth: '2026-07' })
})

it('shows an inline amount error and does not save zero', async () => {
  render(<AddSheet />)

  await userEvent.click(screen.getByRole('button', { name: '保存记录' }))

  expect(screen.getByRole('alert')).toHaveTextContent('请输入大于 0 的金额')
  expect(addTransaction).not.toHaveBeenCalled()
})

it('saves a valid manual expense and closes the sheet', async () => {
  render(<AddSheet />)

  for (const key of ['2', '8', '.', '5', '0']) {
    await userEvent.click(screen.getByRole('button', { name: key }))
  }
  await userEvent.click(screen.getByRole('button', { name: '保存记录' }))

  expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({
    amount: 28.5,
    type: 'expense',
    categoryId: 'sys-food',
    source: 'manual',
  }))
  expect(useAppStore.getState().isAddSheetOpen).toBe(false)
})

it('keeps the global keyboard focus outline available on text inputs', () => {
  render(<AddSheet />)

  expect(screen.getByLabelText('备注（选填）')).not.toHaveStyle({ outline: 'none' })
  expect(screen.getByLabelText('日期')).not.toHaveStyle({ outline: 'none' })
})

it('uses the semantic small-text token for entry labels', () => {
  render(<AddSheet />)

  expect(screen.getByText('金额')).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(screen.getByText('备注（选填）')).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(screen.getByText('日期')).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(screen.getByText('餐饮')).toHaveStyle({ color: 'var(--color-text-small)' })
})

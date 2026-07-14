import { render, screen, waitFor } from '@testing-library/react'
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
  expect(screen.getByLabelText('金额输入')).toHaveFocus()
  expect(screen.getByLabelText('金额输入')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('金额输入')).toHaveAttribute('aria-describedby', 'add-amount-error')
})

it('prevents rapid duplicate saves while pending', async () => {
  let resolveSave!: () => void
  addTransaction.mockImplementation(() => new Promise<void>((resolve) => { resolveSave = resolve }))
  const user = userEvent.setup()
  render(<AddSheet />)

  await user.click(screen.getByRole('button', { name: '2' }))
  const save = screen.getByRole('button', { name: '保存记录' })
  await user.dblClick(save)

  expect(addTransaction).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled()
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled()

  resolveSave()
  await waitFor(() => expect(useAppStore.getState().isAddSheetOpen).toBe(false))
})

it('recovers after a rejected save and keeps the form open', async () => {
  addTransaction.mockRejectedValueOnce(new Error('disk full'))
  const user = userEvent.setup()
  render(<AddSheet />)

  await user.click(screen.getByRole('button', { name: '3' }))
  await user.click(screen.getByRole('button', { name: '保存记录' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  expect(screen.getByRole('button', { name: '保存记录' })).toBeEnabled()
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'false')
  expect(useAppStore.getState().isAddSheetOpen).toBe(true)
})

it('focuses and describes an empty date after a valid amount', async () => {
  const user = userEvent.setup()
  render(<AddSheet />)

  await user.click(screen.getByRole('button', { name: '5' }))
  await user.clear(screen.getByLabelText('日期'))
  await user.click(screen.getByRole('button', { name: '保存记录' }))

  const date = screen.getByLabelText('日期')
  expect(date).toHaveFocus()
  expect(date).toHaveAttribute('aria-invalid', 'true')
  expect(date).toHaveAttribute('aria-describedby', 'add-date-error')
  expect(screen.getByRole('alert')).toHaveTextContent('请选择日期')
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

it('uses the semantic small-text token for the unselected transaction type', () => {
  render(<AddSheet />)

  expect(screen.getByRole('button', { name: '收入' })).toHaveStyle({
    color: 'var(--color-text-small)',
  })
})

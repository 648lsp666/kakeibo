import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import type { Transaction } from '../../types'
import { TransactionItem } from './TransactionItem'
import { TransactionList } from './TransactionList'

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

const olderTransaction: Transaction = {
  ...transaction,
  id: 'tx-2',
  note: '晚餐',
  date: '2026-07-14',
  createdAt: '2026-07-14T18:00:00.000Z',
  updatedAt: '2026-07-14T18:00:00.000Z',
}

it('fills the 72px swipe reveal area with the delete target', () => {
  render(<TransactionItem tx={transaction} onDelete={vi.fn()} />)

  const deleteButton = screen.getByRole('button', { name: '滑动删除午餐' })
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

it('uses the contrast-safe secondary token for the category label', () => {
  render(
    <TransactionItem
      tx={transaction}
      category={{
        id: 'food',
        name: '餐饮',
        type: 'expense',
        icon: 'food',
        isSystem: true,
        sortOrder: 0,
        createdAt: '2026-07-15T00:00:00.000Z',
      }}
      onDelete={vi.fn()}
    />,
  )

  expect(screen.getByText('餐饮')).toHaveStyle({ color: 'var(--color-text-secondary)' })
})

it('uses semantic text tokens for expense and income amounts', () => {
  const { rerender } = render(<TransactionItem tx={transaction} onDelete={vi.fn()} />)
  expect(screen.getByText('-¥25.00')).toHaveStyle({ color: 'var(--color-expense-text)' })

  rerender(<TransactionItem tx={{ ...transaction, type: 'income' }} onDelete={vi.fn()} />)
  expect(screen.getByText('+¥25.00')).toHaveStyle({ color: 'var(--color-income-text)' })
})

it('offers a visible keyboard delete action and keeps the covered swipe action out of the tab order', async () => {
  const user = userEvent.setup()
  render(<TransactionItem tx={transaction} onDelete={vi.fn()} />)

  const keyboardAction = screen.getByRole('button', { name: '删除午餐' })
  const swipeAction = screen.getByRole('button', { name: '滑动删除午餐', hidden: true })
  expect(keyboardAction).toBeVisible()
  expect(swipeAction).toHaveAttribute('tabindex', '-1')

  await user.tab()
  expect(keyboardAction).toHaveFocus()
})

it('uses the custom confirmation dialog, cancels without deleting, and restores focus', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  const nativeConfirm = vi.spyOn(window, 'confirm')
  render(<TransactionList transactions={[transaction]} categories={[]} onDelete={onDelete} />)

  const trigger = screen.getByRole('button', { name: '删除午餐' })
  trigger.focus()
  await user.click(trigger)

  expect(screen.getByRole('dialog', { name: '删除这条记录？' })).toBeInTheDocument()
  expect(nativeConfirm).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '取消' }))

  expect(onDelete).not.toHaveBeenCalled()
  await waitFor(() => expect(trigger).toHaveFocus())
  nativeConfirm.mockRestore()
})

it('confirms deletion once and restores focus after the custom dialog closes', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  function RemovingList() {
    const [transactions, setTransactions] = useState([transaction, olderTransaction])
    onDelete.mockImplementation(async (id: string) => setTransactions(current => current.filter(tx => tx.id !== id)))
    return <TransactionList transactions={transactions} categories={[]} onDelete={onDelete} />
  }
  render(<RemovingList />)

  const trigger = screen.getByRole('button', { name: '删除午餐' })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(onDelete).toHaveBeenCalledOnce()
  expect(onDelete).toHaveBeenCalledWith(transaction.id)
  await waitFor(() => expect(screen.getByRole('button', { name: '删除晚餐' })).toHaveFocus())
})

it('moves focus to the ledger region when confirming removes the final item', async () => {
  const user = userEvent.setup()
  function RemovingList() {
    const [transactions, setTransactions] = useState([transaction])
    return <TransactionList transactions={transactions} categories={[]} onDelete={() => setTransactions([])} />
  }
  render(<RemovingList />)

  await user.click(screen.getByRole('button', { name: '删除午餐' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  await waitFor(() => expect(screen.getByRole('region', { name: '交易记录' })).toHaveFocus())
})

it('keeps the dialog open, reports delete rejection, and allows retry', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  let removeTransaction!: () => void
  onDelete.mockRejectedValueOnce(new Error('数据库不可用'))
    .mockImplementationOnce(async () => removeTransaction())
  function RetryList() {
    const [transactions, setTransactions] = useState([transaction])
    removeTransaction = () => setTransactions([])
    return <TransactionList transactions={transactions} categories={[]} onDelete={onDelete} />
  }
  render(<RetryList />)

  await user.click(screen.getByRole('button', { name: '删除午餐' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('删除失败：数据库不可用')
  expect(screen.getByRole('dialog', { name: '删除这条记录？' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '确认删除' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: '确认删除' }))
  expect(onDelete).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('allows cancel after a rejected delete and restores the trigger focus', async () => {
  const user = userEvent.setup()
  render(<TransactionList transactions={[transaction]} categories={[]} onDelete={vi.fn().mockRejectedValue(new Error('失败'))} />)

  const trigger = screen.getByRole('button', { name: '删除午餐' })
  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: '确认删除' }))
  await screen.findByRole('alert')
  await user.click(screen.getByRole('button', { name: '取消' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('focuses the adjacent row across date groups after actual removal', async () => {
  const user = userEvent.setup()
  function MultiDateList() {
    const [transactions, setTransactions] = useState([transaction, olderTransaction])
    return <TransactionList transactions={transactions} categories={[]} onDelete={async id => setTransactions(current => current.filter(tx => tx.id !== id))} />
  }
  render(<MultiDateList />)

  await user.click(screen.getByRole('button', { name: '删除午餐' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  await waitFor(() => expect(screen.getByRole('button', { name: '删除晚餐' })).toHaveFocus())
})

it('waits for the flattened transaction props to update before closing and focusing', async () => {
  const user = userEvent.setup()
  let resolvePersistence!: () => void
  let removePersisted!: () => void
  function DeferredList() {
    const [transactions, setTransactions] = useState([transaction, olderTransaction])
    removePersisted = () => setTransactions(current => current.filter(tx => tx.id !== transaction.id))
    return <TransactionList transactions={transactions} categories={[]} onDelete={() => new Promise<void>(resolve => { resolvePersistence = resolve })} />
  }
  render(<DeferredList />)

  await user.click(screen.getByRole('button', { name: '删除午餐' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))
  await act(async () => resolvePersistence())

  await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true'))
  expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled()

  await act(async () => removePersisted())
  await waitFor(() => expect(screen.getByRole('button', { name: '删除晚餐' })).toHaveFocus())
})

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ConfirmDialog, EmptyState, InlineNotice } from './Feedback'

it('exposes semantic status text', () => {
  render(<InlineNotice tone="error">连接失败</InlineNotice>)
  expect(screen.getByRole('alert')).toHaveTextContent('连接失败')
})

it('renders an empty state action', async () => {
  const onAction = vi.fn()
  render(<EmptyState icon="ledger" title="本月暂无记录" actionLabel="记一笔" onAction={onAction} />)
  await userEvent.click(screen.getByRole('button', { name: '记一笔' }))
  expect(onAction).toHaveBeenCalledOnce()
})

it('uses the contrast-safe secondary token for empty-state descriptions', () => {
  render(<EmptyState icon="ledger" title="本月暂无记录" description="记下第一笔收支" />)

  expect(screen.getByText('记下第一笔收支')).toHaveStyle({
    color: 'var(--color-text-secondary)',
  })
})

it('requires explicit confirmation', async () => {
  const onConfirm = vi.fn()
  render(
    <ConfirmDialog
      open
      title="清除所有账单？"
      description="此操作不可恢复"
      confirmLabel="确认清除"
      onConfirm={onConfirm}
      onClose={() => {}}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: '确认清除' }))
  expect(onConfirm).toHaveBeenCalledOnce()
})

it('blocks every close path and exposes busy state while confirmation is pending', async () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(
    <ConfirmDialog open title="正在保存" description="请稍候" confirmLabel="保存中…" busy onConfirm={() => {}} onClose={onClose} />,
  )

  const dialog = screen.getByRole('dialog', { name: '正在保存' })
  expect(dialog).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled()
  await user.keyboard('{Escape}')
  await user.click(dialog.parentElement!)

  expect(onClose).not.toHaveBeenCalled()
  expect(dialog).toBeInTheDocument()
})

it('allows header, Escape, and backdrop close paths when not busy', async () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  const { rerender } = render(
    <ConfirmDialog open title="确认操作" description="说明" confirmLabel="确认" onConfirm={() => {}} onClose={onClose} />,
  )

  await user.click(screen.getByRole('button', { name: '关闭' }))
  expect(onClose).toHaveBeenCalledTimes(1)

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(2)

  const dialog = screen.getByRole('dialog')
  await user.click(dialog.parentElement!)
  expect(onClose).toHaveBeenCalledTimes(3)

  rerender(<ConfirmDialog open={false} title="确认操作" description="说明" confirmLabel="确认" onConfirm={() => {}} onClose={onClose} />)
})

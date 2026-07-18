import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { CategoryForm } from './CategoryForm'

it('submits a stable icon name instead of emoji', async () => {
  const onSave = vi.fn()
  render(<CategoryForm onSave={onSave} onCancel={() => {}} />)

  await userEvent.type(screen.getByLabelText('分类名称'), '咖啡')
  await userEvent.click(screen.getByRole('button', { name: '咖啡图标' }))
  await userEvent.click(screen.getByRole('button', { name: '保存分类' }))

  expect(onSave).toHaveBeenCalledWith({ name: '咖啡', icon: 'coffee', type: 'expense' })
})

it('shows inline validation for an empty name', async () => {
  const onSave = vi.fn()
  render(<CategoryForm onSave={onSave} onCancel={() => {}} />)

  await userEvent.click(screen.getByRole('button', { name: '保存分类' }))

  expect(screen.getByRole('alert')).toHaveTextContent('请输入分类名称')
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByLabelText('分类名称')).toHaveFocus()
  expect(screen.getByLabelText('分类名称')).toHaveAttribute('aria-describedby', 'category-name-error')
})

it('prevents duplicate async saves and disables cancel while pending', async () => {
  let resolveSave!: () => void
  const onSave = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve }))
  const user = userEvent.setup()
  render(<CategoryForm onSave={onSave} onCancel={vi.fn()} />)

  await user.type(screen.getByLabelText('分类名称'), '咖啡')
  await user.dblClick(screen.getByRole('button', { name: '保存分类' }))

  expect(onSave).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '取消' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '保存中…' }).closest('div')?.parentElement).toHaveAttribute('aria-busy', 'true')

  resolveSave()
  await waitFor(() => expect(screen.getByRole('button', { name: '保存分类' })).toBeEnabled())
})

it('recovers after a rejected async save', async () => {
  const onSave = vi.fn().mockRejectedValueOnce(new Error('write failed'))
  const user = userEvent.setup()
  render(<CategoryForm onSave={onSave} onCancel={vi.fn()} />)

  await user.type(screen.getByLabelText('分类名称'), '咖啡')
  await user.click(screen.getByRole('button', { name: '保存分类' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  expect(screen.getByRole('button', { name: '保存分类' })).toBeEnabled()
  expect(screen.getByRole('button', { name: '取消' })).toBeEnabled()
  expect(screen.getByLabelText('分类名称')).toHaveAttribute('aria-invalid', 'false')
  expect(screen.getByLabelText('分类名称')).not.toHaveAttribute('aria-describedby')
})

it('uses responsive columns that preserve the minimum tap width', () => {
  render(<CategoryForm onSave={() => {}} onCancel={() => {}} />)

  expect(screen.getByRole('group', { name: '选择图标' })).toHaveStyle({
    gridTemplateColumns: 'repeat(auto-fit, minmax(var(--tap-size), 1fr))',
  })
})

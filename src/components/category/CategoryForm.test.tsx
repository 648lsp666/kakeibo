import { render, screen } from '@testing-library/react'
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
})

it('uses responsive columns that preserve the minimum tap width', () => {
  render(<CategoryForm onSave={() => {}} onCancel={() => {}} />)

  expect(screen.getByRole('group', { name: '选择图标' })).toHaveStyle({
    gridTemplateColumns: 'repeat(auto-fit, minmax(var(--tap-size), 1fr))',
  })
})

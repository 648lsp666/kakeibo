import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { CategoryPage } from './CategoryPage'

const { addCategory } = vi.hoisted(() => ({ addCategory: vi.fn() }))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ categories: [], addCategory, deleteCategory: vi.fn() }),
}))

beforeEach(() => { addCategory.mockReset() })

it('blocks header, Escape, and backdrop closing while category save is pending', async () => {
  let resolveSave!: () => void
  addCategory.mockImplementation(() => new Promise<void>(resolve => { resolveSave = resolve }))
  const user = userEvent.setup()
  render(<CategoryPage />)

  await user.click(screen.getByRole('button', { name: '新建分类' }))
  await user.type(screen.getByLabelText('分类名称'), '咖啡')
  await user.click(screen.getByRole('button', { name: '保存分类' }))

  const dialog = screen.getByRole('dialog', { name: '新建分类' })
  expect(dialog).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled()
  await user.keyboard('{Escape}')
  await user.click(dialog.parentElement!)
  expect(screen.getByRole('dialog', { name: '新建分类' })).toBeInTheDocument()

  await act(async () => resolveSave())
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建分类' })).not.toBeInTheDocument())
})

it('restores all close paths after a rejected category save', async () => {
  addCategory.mockRejectedValueOnce(new Error('write failed'))
  const user = userEvent.setup()
  render(<CategoryPage />)

  await user.click(screen.getByRole('button', { name: '新建分类' }))
  await user.type(screen.getByLabelText('分类名称'), '咖啡')
  await user.click(screen.getByRole('button', { name: '保存分类' }))
  await screen.findByRole('alert')

  expect(screen.getByRole('button', { name: '关闭' })).toBeEnabled()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '新建分类' })).not.toBeInTheDocument())
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { categoryOps, getDb } from '../lib/db'
import type { NewCategoryInput } from './useCategories'
import { useCategories } from './useCategories'

vi.mock('../lib/seed', () => ({
  seedCategories: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(async () => {
  const db = await getDb()
  await db.clear('categories')
})

it('persists only category fields accepted at the hook boundary', async () => {
  const { result } = renderHook(() => useCategories())

  await waitFor(() => expect(result.current.categories).toEqual([]))

  const input = {
    name: '咖啡',
    icon: 'coffee',
    type: 'expense',
    emoji: '☕',
  } as NewCategoryInput

  await act(async () => {
    await result.current.addCategory(input)
  })

  const [stored] = await categoryOps.list()
  expect(stored).toMatchObject({ name: '咖啡', icon: 'coffee', type: 'expense' })
  expect(Object.prototype.hasOwnProperty.call(stored, 'emoji')).toBe(false)
})

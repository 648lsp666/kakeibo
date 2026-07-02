import { describe, it, expect, beforeEach } from 'vitest'
import { seedCategories, SYSTEM_CATEGORIES } from './seed'
import { categoryOps, getDb } from './db'

beforeEach(async () => {
  const db = await getDb()
  await db.clear('categories')
})

describe('seedCategories', () => {
  it('inserts all system categories on first run', async () => {
    await seedCategories()
    const cats = await categoryOps.list()
    expect(cats).toHaveLength(SYSTEM_CATEGORIES.length)
  })

  it('is idempotent — second run does not duplicate', async () => {
    await seedCategories()
    await seedCategories()
    const cats = await categoryOps.list()
    expect(cats).toHaveLength(SYSTEM_CATEGORIES.length)
  })

  it('includes 餐饮 with correct emoji', async () => {
    await seedCategories()
    const cats = await categoryOps.list()
    const canteen = cats.find(c => c.name === '餐饮')
    expect(canteen?.emoji).toBe('🍜')
    expect(canteen?.isSystem).toBe(true)
  })
})

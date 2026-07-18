import { useState, useEffect, useCallback } from 'react'
import { categoryOps } from '../lib/db'
import { seedCategories } from '../lib/seed'
import type { Category } from '../types'
import type { IconName } from '../components/ui/Icon'
import { nanoid } from 'nanoid'

export type NewCategoryInput = {
  name: string
  icon: IconName
  type: Category['type']
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])

  const load = useCallback(async () => {
    await seedCategories()
    const data = await categoryOps.list()
    setCategories(data)
  }, [])

  useEffect(() => { load() }, [load])

  const addCategory = useCallback(async (input: NewCategoryInput) => {
    const existing = await categoryOps.list()
    const maxSort = existing.reduce((m, c) => Math.max(m, c.sortOrder), 0)
    const cat: Category = {
      id: nanoid(),
      name: input.name,
      icon: input.icon,
      type: input.type,
      isSystem: false,
      sortOrder: maxSort + 1,
      createdAt: new Date().toISOString(),
    }
    await categoryOps.add(cat)
    await load()
  }, [load])

  const deleteCategory = useCallback(async (id: string) => {
    const cat = categories.find(c => c.id === id)
    if (cat?.isSystem) throw new Error('系统分类不可删除')
    await categoryOps.delete(id)
    await load()
  }, [categories, load])

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  return { categories, expenseCategories, incomeCategories, addCategory, deleteCategory, refresh: load }
}

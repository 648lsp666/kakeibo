import { categoryOps } from './db'
import type { Category } from '../types'

export const SYSTEM_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  { id: 'sys-food',     name: '餐饮',   emoji: '🍜', type: 'expense', isSystem: true, sortOrder: 0 },
  { id: 'sys-shop',     name: '购物',   emoji: '🛒', type: 'expense', isSystem: true, sortOrder: 1 },
  { id: 'sys-transit',  name: '出行',   emoji: '🚌', type: 'expense', isSystem: true, sortOrder: 2 },
  { id: 'sys-fun',      name: '娱乐',   emoji: '🎮', type: 'expense', isSystem: true, sortOrder: 3 },
  { id: 'sys-home',     name: '居家',   emoji: '🏠', type: 'expense', isSystem: true, sortOrder: 4 },
  { id: 'sys-medical',  name: '医疗',   emoji: '💊', type: 'expense', isSystem: true, sortOrder: 5 },
  { id: 'sys-edu',      name: '学习',   emoji: '📚', type: 'expense', isSystem: true, sortOrder: 6 },
  { id: 'sys-other-ex', name: '其他',   emoji: '📦', type: 'expense', isSystem: true, sortOrder: 7 },
  { id: 'sys-salary',   name: '工资',   emoji: '💼', type: 'income',  isSystem: true, sortOrder: 8 },
  { id: 'sys-freelance',name: '兼职',   emoji: '💰', type: 'income',  isSystem: true, sortOrder: 9 },
  { id: 'sys-other-in', name: '其他收入',emoji: '🎁', type: 'income', isSystem: true, sortOrder: 10 },
]

export async function seedCategories(): Promise<void> {
  const existing = await categoryOps.list()
  const existingIds = new Set(existing.map(c => c.id))
  const now = new Date().toISOString()
  for (const cat of SYSTEM_CATEGORIES) {
    if (!existingIds.has(cat.id)) {
      await categoryOps.add({ ...cat, createdAt: now })
    }
  }
}

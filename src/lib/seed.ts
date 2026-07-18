import { categoryOps } from './db'
import type { Category } from '../types'

export const SYSTEM_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  { id: 'sys-food',     name: '餐饮',   icon: 'food', type: 'expense', isSystem: true, sortOrder: 0 },
  { id: 'sys-shop',     name: '购物',   icon: 'cart', type: 'expense', isSystem: true, sortOrder: 1 },
  { id: 'sys-transit',  name: '出行',   icon: 'transit', type: 'expense', isSystem: true, sortOrder: 2 },
  { id: 'sys-fun',      name: '娱乐',   icon: 'game', type: 'expense', isSystem: true, sortOrder: 3 },
  { id: 'sys-home',     name: '居家',   icon: 'home', type: 'expense', isSystem: true, sortOrder: 4 },
  { id: 'sys-medical',  name: '医疗',   icon: 'medical', type: 'expense', isSystem: true, sortOrder: 5 },
  { id: 'sys-edu',      name: '学习',   icon: 'book', type: 'expense', isSystem: true, sortOrder: 6 },
  { id: 'sys-transfer-ex', name: '转账支出', icon: 'transfer', type: 'expense', isSystem: true, sortOrder: 7 },
  { id: 'sys-other-ex', name: '其他',   icon: 'category', type: 'expense', isSystem: true, sortOrder: 8 },
  { id: 'sys-salary',   name: '工资',   icon: 'briefcase', type: 'income',  isSystem: true, sortOrder: 9 },
  { id: 'sys-freelance',name: '兼职',   icon: 'coins', type: 'income',  isSystem: true, sortOrder: 10 },
  { id: 'sys-transfer-in', name: '转账收入', icon: 'transfer', type: 'income', isSystem: true, sortOrder: 11 },
  { id: 'sys-other-in', name: '其他收入',icon: 'gift', type: 'income', isSystem: true, sortOrder: 12 },
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

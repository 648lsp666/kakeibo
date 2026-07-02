export type TransactionType = 'income' | 'expense'
export type TransactionSource = 'manual' | 'wechat' | 'alipay'

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  categoryId: string
  note: string
  date: string        // 'YYYY-MM-DD'
  source: TransactionSource
  externalId?: string // 交易单号，CSV 去重用
  createdAt: string   // ISO 8601
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  emoji: string
  type: TransactionType
  isSystem: boolean
  sortOrder: number
  createdAt: string
}

export interface SyncConfig {
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  lastSyncAt?: string
}

export interface DailyGroup {
  date: string           // 'YYYY-MM-DD'
  transactions: Transaction[]
  total: number          // 负数表示支出
}

export interface MonthSummary {
  income: number
  expense: number
  balance: number
}

export type BudgetPeriod = 'monthly' | 'yearly' | 'custom'

export interface BudgetRule {
  id: string
  amount: number
  period: BudgetPeriod
  startDate?: string   // 'YYYY-MM-DD', custom only
  endDate?: string     // 'YYYY-MM-DD', custom only
}

export interface BudgetStatus {
  spending: number
  limit: number
  pct: number         // 0-1+, spending/limit
  isOver: boolean
  remaining: number   // limit - spending (negative if over)
  label: string
  subLabel: string
}

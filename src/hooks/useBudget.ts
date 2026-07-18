import { useState, useEffect, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { budgetOps, transactionOps } from '../lib/db'
import { useAppStore } from '../store/appStore'
import type { BudgetRule, BudgetStatus, Transaction } from '../types'
import { domainRepository } from '../sync/domain-repository'

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function computeStatus(rule: BudgetRule, all: Transaction[]): BudgetStatus {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  let startDate: string
  let endDate: string
  let label: string

  if (rule.period === 'monthly') {
    const y = today.getFullYear(), m = today.getMonth()
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    label = '月预算'
  } else if (rule.period === 'yearly') {
    startDate = `${today.getFullYear()}-01-01`
    endDate = `${today.getFullYear()}-12-31`
    label = '年预算'
  } else {
    startDate = rule.startDate!
    endDate = rule.endDate!
    label = `${startDate.slice(5)} ~ ${endDate.slice(5)}`
  }

  const effectiveEnd = todayStr < endDate ? todayStr : endDate
  const spending = all
    .filter(t => t.type === 'expense' && t.date >= startDate && t.date <= effectiveEnd)
    .reduce((s, t) => s + t.amount, 0)

  const limit = rule.amount
  const pct = limit > 0 ? spending / limit : 0
  const isOver = spending > limit
  const remaining = limit - spending

  let subLabel: string
  if (rule.period === 'monthly') {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysLeft = lastDay - today.getDate() + 1
    subLabel = isOver
      ? `超支 ¥${Math.abs(remaining).toFixed(2)}`
      : `日均可用 ¥${(remaining / Math.max(daysLeft, 1)).toFixed(0)} · 还剩 ${daysLeft} 天`
  } else if (rule.period === 'yearly') {
    const monthlyEquiv = (limit / 12).toFixed(0)
    const daysLeft = daysBetween(todayStr, endDate) + 1
    subLabel = isOver
      ? `超支 ¥${Math.abs(remaining).toFixed(2)}`
      : `月均 ¥${monthlyEquiv} · 日均可用 ¥${(remaining / Math.max(daysLeft, 1)).toFixed(0)}`
  } else {
    const totalDays = daysBetween(startDate, endDate) + 1
    const daysLeft = Math.max(daysBetween(todayStr, endDate) + 1, 0)
    subLabel = isOver
      ? `超支 ¥${Math.abs(remaining).toFixed(2)}`
      : `日预算 ¥${(limit / Math.max(totalDays, 1)).toFixed(0)} · 还剩 ${daysLeft} 天`
  }

  return { spending, limit, pct, isOver, remaining, label, subLabel }
}

export type RuleWithStatus = BudgetStatus & { rule: BudgetRule }

export function useBudget() {
  const [rules, setRules] = useState<BudgetRule[]>([])
  const [statuses, setStatuses] = useState<RuleWithStatus[]>([])
  const refreshSignal = useAppStore(s => s.refreshSignal)

  const triggerRefresh = useAppStore(s => s.triggerRefresh)

  const load = useCallback(async () => {
    const list = await budgetOps.list()
    setRules(list)
    if (list.length === 0) { setStatuses([]); return }
    const all = await transactionOps.getAll()
    setStatuses(list.map(rule => ({ rule, ...computeStatus(rule, all) })))
  }, [refreshSignal])

  useEffect(() => { load() }, [load])

  const publish = async (updated: BudgetRule[]) => {
    // Update this instance immediately, then signal other instances to reload
    setRules(updated)
    const all = await transactionOps.getAll()
    setStatuses(updated.map(rule => ({ rule, ...computeStatus(rule, all) })))
    triggerRefresh()
  }

  const addRule = async (data: Omit<BudgetRule, 'id'>) => {
    const rule = { ...data, id: nanoid() }
    await domainRepository.upsert('budget', rule)
    await publish([...rules, rule])
  }

  const updateRule = async (updated: BudgetRule) => {
    await domainRepository.upsert('budget', updated)
    await publish(rules.map(r => r.id === updated.id ? updated : r))
  }

  const deleteRule = async (id: string) => {
    await domainRepository.remove('budget', id)
    await publish(rules.filter(r => r.id !== id))
  }

  // Monthly equivalent for chart budget line
  const monthlyBudgetAmount = (() => {
    const m = rules.find(r => r.period === 'monthly')
    if (m) return m.amount
    const y = rules.find(r => r.period === 'yearly')
    if (y) return y.amount / 12
    return undefined
  })()

  return { rules, statuses, monthlyBudgetAmount, addRule, updateRule, deleteRule }
}

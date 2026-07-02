import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useStats } from '../hooks/useStats'
import { useCategories } from '../hooks/useCategories'
import { useBudget } from '../hooks/useBudget'
import { MonthPickerSheet } from '../components/ledger/MonthPickerSheet'
import { BudgetSection } from '../components/budget/BudgetSection'

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmt(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const AMOUNT_H = 16  // fixed area for amount labels above bars
const BAR_H = 60     // max bar height
const LABEL_H = 20   // month label height
const CHART_H = AMOUNT_H + BAR_H + LABEL_H  // 96px total, no overflow

export function StatsPage() {
  const { currentMonth, setCurrentMonth } = useAppStore()
  const { categoryStats, monthlyTrend, totalExpense, totalIncome } = useStats(currentMonth)
  const { categories } = useCategories()
  const { monthlyBudgetAmount } = useBudget()
  const [showPicker, setShowPicker] = useState(false)

  const [year, month] = currentMonth.split('-')
  const catMap = new Map(categories.map(c => [c.id, c]))

  const maxExpense = Math.max(...monthlyTrend.map(t => t.expense), monthlyBudgetAmount ?? 0, 1)

  // Budget line: distance from bottom of chart container
  const budgetLineBottom = monthlyBudgetAmount != null && maxExpense > 0
    ? LABEL_H + Math.min(monthlyBudgetAmount / maxExpense, 1) * BAR_H
    : null

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 24 }}>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '16px 16px 0' }}>
        <button onClick={() => setCurrentMonth(shiftMonth(currentMonth, -1))} style={arrowBtn}>‹</button>
        <button onClick={() => setShowPicker(true)} style={monthBtn}>{year}年{month}月</button>
        <button onClick={() => setCurrentMonth(shiftMonth(currentMonth, 1))} style={arrowBtn}>›</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
        <div style={card}>
          <div style={cardLabel}>支出</div>
          <div style={{ ...cardValue, color: 'var(--color-expense)' }}>¥{fmt(totalExpense)}</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>收入</div>
          <div style={{ ...cardValue, color: 'var(--color-income)' }}>¥{fmt(totalIncome)}</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>结余</div>
          <div style={cardValue}>¥{fmt(totalIncome - totalExpense)}</div>
        </div>
      </div>

      {/* Budget rules */}
      <BudgetSection />

      {/* 6-month trend */}
      <div style={section}>
        <div style={sectionTitle}>近6个月支出趋势</div>

        {/* Chart — three fixed-height rows: amount label / bar / month label */}
        <div style={{ position: 'relative', height: CHART_H }}>

          {/* Budget line (absolute from bottom) */}
          {budgetLineBottom !== null && (
            <div style={{
              position: 'absolute', left: 0, right: 0,
              bottom: budgetLineBottom,
              zIndex: 2, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <div style={{ flex: 1, borderTop: '1.5px dashed #fb923c', opacity: 0.85 }} />
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#fb923c',
                background: 'var(--color-stat-card)', padding: '1px 5px', borderRadius: 4, flexShrink: 0,
              }}>
                {monthlyBudgetAmount! >= 1000
                  ? `¥${(monthlyBudgetAmount! / 1000).toFixed(1)}k`
                  : `¥${Math.round(monthlyBudgetAmount!)}`}
              </span>
            </div>
          )}

          {/* Bars */}
          <div style={{ display: 'flex', gap: 5, height: CHART_H }}>
            {monthlyTrend.map(t => {
              const isCurrent = t.yearMonth === currentMonth
              const isOverBudget = monthlyBudgetAmount != null && t.expense > monthlyBudgetAmount
              const barH = t.expense > 0 ? Math.max(Math.round((t.expense / maxExpense) * BAR_H), 3) : 0
              const barColor = isOverBudget ? '#f87171' : isCurrent ? '#3b82f6' : '#94a3b8'

              return (
                <div key={t.yearMonth} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Amount label — fixed height, no overflow */}
                  <div style={{ height: AMOUNT_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.expense > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: isOverBudget ? '#f87171' : isCurrent ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                      }}>
                        {t.expense >= 1000 ? `${(t.expense / 1000).toFixed(1)}k` : Math.round(t.expense)}
                      </span>
                    )}
                  </div>
                  {/* Bar — fixed height BAR_H, bar grows from bottom */}
                  <div style={{ height: BAR_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: barH, borderRadius: '4px 4px 0 0',
                      background: barColor, opacity: isCurrent ? 0.9 : 0.45,
                    }} />
                  </div>
                  {/* Month label — fixed height */}
                  <div style={{ height: LABEL_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: isCurrent ? 800 : 500,
                      color: isCurrent ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    }}>
                      {t.monthLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#3b82f6', opacity: 0.9 }} />
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>当月</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8', opacity: 0.55 }} />
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>历史</span>
          </div>
          {monthlyBudgetAmount != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 0, borderTop: '1.5px dashed #fb923c' }} />
              <span style={{ fontSize: 10, color: '#fb923c' }}>月预算</span>
            </div>
          )}
          {monthlyTrend.some(t => monthlyBudgetAmount != null && t.expense > monthlyBudgetAmount) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f87171' }} />
              <span style={{ fontSize: 10, color: '#f87171' }}>超预算</span>
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div style={section}>
        <div style={sectionTitle}>本月支出分类</div>
        {categoryStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            本月暂无支出记录
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categoryStats.map(stat => {
              const cat = catMap.get(stat.categoryId)
              return (
                <div key={stat.categoryId}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{cat?.emoji ?? '📦'}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{cat?.name ?? '未分类'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{Math.round(stat.pct * 100)}%</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-expense)' }}>¥{fmt(stat.amount)}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--color-bg-secondary)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${stat.pct * 100}%`,
                      borderRadius: 3, background: '#3b82f6', opacity: 0.65,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showPicker && (
        <MonthPickerSheet
          value={currentMonth}
          onChange={setCurrentMonth}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

const arrowBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: '2px 8px',
  cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)', fontWeight: 700,
}
const monthBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: '2px 4px',
  cursor: 'pointer', fontSize: 16, fontWeight: 800, color: 'var(--color-text)',
}
const card: React.CSSProperties = {
  flex: 1, background: 'var(--color-stat-card)', borderRadius: 12, padding: '10px 12px',
  boxShadow: '0 1px 4px var(--color-stat-shadow)',
}
const cardLabel: React.CSSProperties = {
  fontSize: 9, color: 'var(--color-text-tertiary)', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
}
const cardValue: React.CSSProperties = {
  fontSize: 15, fontWeight: 800, color: 'var(--color-text)',
}
const section: React.CSSProperties = {
  margin: '12px 16px 0', background: 'var(--color-stat-card)',
  borderRadius: 14, padding: 14, boxShadow: '0 1px 4px var(--color-stat-shadow)',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, color: 'var(--color-text)', marginBottom: 14,
}

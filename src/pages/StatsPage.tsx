import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useStats } from '../hooks/useStats'
import { useCategories } from '../hooks/useCategories'
import { useBudget } from '../hooks/useBudget'
import { MonthPickerSheet } from '../components/ledger/MonthPickerSheet'
import { BudgetSection } from '../components/budget/BudgetSection'
import { categoryIconName, Icon } from '../components/ui/Icon'

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
  const { categoryStats, merchantStats, monthlyTrend, totalExpense, totalIncome } = useStats(currentMonth)
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
    <div className="page-scroll">

      {/* Month nav */}
      <nav aria-label="统计月份" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <button type="button" aria-label="上个月" onClick={() => setCurrentMonth(shiftMonth(currentMonth, -1))} style={arrowBtn}>
          <Icon name="chevron-left" />
        </button>
        <button type="button" aria-label="选择月份" onClick={() => setShowPicker(true)} style={monthBtn}>{year}年{month}月</button>
        <button type="button" aria-label="下个月" onClick={() => setCurrentMonth(shiftMonth(currentMonth, 1))} style={arrowBtn}>
          <Icon name="chevron-right" />
        </button>
      </nav>

      {/* Summary cards */}
      <section aria-label="本月收支概览" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
        <div className="surface" style={card}>
          <div style={cardLabel}>本月支出</div>
          <div style={{ ...cardValue, color: 'var(--color-expense)' }}>¥{fmt(totalExpense)}</div>
        </div>
        <div className="surface" style={card}>
          <div style={cardLabel}>本月收入</div>
          <div style={{ ...cardValue, color: 'var(--color-income)' }}>¥{fmt(totalIncome)}</div>
        </div>
        <div className="surface" style={card}>
          <div style={cardLabel}>本月结余</div>
          <div style={cardValue}>¥{fmt(totalIncome - totalExpense)}</div>
        </div>
      </section>

      {/* Budget rules */}
      <BudgetSection />

      {/* 6-month trend */}
      <section className="surface" style={section}>
        <h2 style={sectionTitle}>近 6 个月</h2>

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
              <div style={{ flex: 1, borderTop: '1.5px dashed var(--color-warning)', opacity: 0.85 }} />
              <span style={{
                fontSize: 9, fontWeight: 700, color: 'var(--color-warning)',
                background: 'var(--color-bg-card)', padding: '1px 5px', borderRadius: 4, flexShrink: 0,
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
              const barColor = isOverBudget ? 'var(--color-expense)' : isCurrent ? 'var(--color-primary)' : 'var(--color-text-tertiary)'

              return (
                <div key={t.yearMonth} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Amount label — fixed height, no overflow */}
                  <div style={{ height: AMOUNT_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.expense > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: isOverBudget ? 'var(--color-expense)' : isCurrent ? 'var(--color-text)' : 'var(--color-text-tertiary)',
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
                      color: isCurrent ? 'var(--color-text)' : 'var(--color-text-small)',
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
            <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary)', opacity: 0.9 }} />
            <span style={{ fontSize: 10, color: 'var(--color-text-small)' }}>当月</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-text-tertiary)', opacity: 0.55 }} />
            <span style={{ fontSize: 10, color: 'var(--color-text-small)' }}>历史</span>
          </div>
          {monthlyBudgetAmount != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 0, borderTop: '1.5px dashed var(--color-warning)' }} />
              <span style={{ fontSize: 10, color: 'var(--color-warning)' }}>月预算</span>
            </div>
          )}
          {monthlyTrend.some(t => monthlyBudgetAmount != null && t.expense > monthlyBudgetAmount) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-expense)' }} />
              <span style={{ fontSize: 10, color: 'var(--color-expense)' }}>超预算</span>
            </div>
          )}
        </div>
      </section>

      {/* Category breakdown */}
      <section className="surface" style={section}>
        <h2 style={sectionTitle}>本月支出分类</h2>
        {categoryStats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-small)', fontSize: 13 }}>
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
                      <span style={rowIcon}><Icon name={categoryIconName(cat)} size={18} /></span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{cat?.name ?? '未分类'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-text-small)' }}>{Math.round(stat.pct * 100)}%</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-expense)' }}>¥{fmt(stat.amount)}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--color-bg-secondary)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${stat.pct * 100}%`,
                      borderRadius: 3, background: 'var(--color-primary)', opacity: 0.65,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Merchant breakdown */}
      {merchantStats.length > 0 && (
        <section className="surface" style={section}>
          <h2 style={sectionTitle}>本月商户消费</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {merchantStats.map((stat) => (
              <div key={stat.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={rowIcon}><Icon name="wallet" size={18} /></span>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{stat.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-small)', marginLeft: 6 }}>{stat.count} 笔</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-small)' }}>{Math.round(stat.pct * 100)}%</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-expense)' }}>¥{fmt(stat.amount)}</span>
                  </div>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--color-bg-secondary)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${stat.pct * 100}%`,
                    borderRadius: 3,
                    background: 'var(--color-primary)',
                    opacity: 0.75,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
  alignItems: 'center', background: 'none', border: 'none', borderRadius: 'var(--radius-control)',
  color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'inline-flex',
  justifyContent: 'center', minHeight: 'var(--tap-size)', minWidth: 'var(--tap-size)',
}
const monthBtn: React.CSSProperties = {
  background: 'none', border: 'none', borderRadius: 'var(--radius-control)', minHeight: 'var(--tap-size)', padding: '2px 12px',
  cursor: 'pointer', fontSize: 16, fontWeight: 800, color: 'var(--color-text)',
}
const card: React.CSSProperties = {
  minWidth: 0, padding: '12px 10px',
}
const cardLabel: React.CSSProperties = {
  fontSize: 10, color: 'var(--color-text-small)', fontWeight: 600, marginBottom: 5,
}
const cardValue: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: 'var(--color-text)', overflowWrap: 'anywhere',
}
const section: React.CSSProperties = {
  marginTop: 12, padding: 16,
}
const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 14,
}
const rowIcon: React.CSSProperties = {
  alignItems: 'center', color: 'var(--color-primary-strong)', display: 'inline-flex', justifyContent: 'center',
}

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useStats, type DailyStat, type MonthTrend } from '../hooks/useStats'
import { useCategories } from '../hooks/useCategories'
import { useBudget } from '../hooks/useBudget'
import { MonthPickerSheet } from '../components/ledger/MonthPickerSheet'
import { BudgetSection } from '../components/budget/BudgetSection'
import { categoryIconName, Icon } from '../components/ui/Icon'
import { motion, useReducedMotion } from 'framer-motion'

type Period = 'month' | 'halfYear' | 'year'

function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const date = new Date(year, month - 1 + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function fmt(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function compactAmount(value: number) {
  const absolute = Math.abs(value)
  const amount = absolute >= 10000
    ? `${Number((absolute / 10000).toFixed(1))}万`
    : absolute >= 1000
      ? `${Number((absolute / 1000).toFixed(1))}k`
      : `${Number(absolute.toFixed(0))}`
  return `${value >= 0 ? '+' : '−'}${amount}`
}

function monthDays(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number)
  const total = new Date(year, month, 0).getDate()
  const mondayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7
  return [
    ...Array.from({ length: mondayOffset }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ]
}

function DailyCalendar({ yearMonth, stats }: { yearMonth: string; stats: DailyStat[] }) {
  const statsByDate = useMemo(() => new Map(stats.map(stat => [stat.date, stat])), [stats])
  const populatedDay = stats[stats.length - 1]?.date.slice(-2)
  const [selectedDay, setSelectedDay] = useState(Number(populatedDay ?? '1'))
  const cells = monthDays(yearMonth)

  useEffect(() => {
    setSelectedDay(Number(stats[stats.length - 1]?.date.slice(-2) ?? '1'))
  }, [yearMonth, stats])

  const selectedDate = `${yearMonth}-${String(selectedDay).padStart(2, '0')}`
  const selected = statsByDate.get(selectedDate)

  return (
    <section className="surface" style={{ ...section, padding: 12 }} aria-label="本月每日收支日历">
      <div className="calendar-week-grid" style={weekGrid} aria-hidden="true">
        {['一', '二', '三', '四', '五', '六', '日'].map(day => <span key={day} style={weekLabel}>{day}</span>)}
      </div>
      <div className="calendar-grid" style={calendarGrid}>
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />
          const date = `${yearMonth}-${String(day).padStart(2, '0')}`
          const stat = statsByDate.get(date)
          const isSelected = day === selectedDay
          return (
            <button
              type="button"
              className="calendar-day"
              key={date}
              aria-label={`${day}日${stat ? `，净额${stat.net >= 0 ? '正' : '负'}${fmt(Math.abs(stat.net))}元` : '，无收支'}`}
              aria-pressed={isSelected}
              onClick={() => setSelectedDay(day)}
              style={{
                ...dayCell,
                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                background: isSelected ? 'var(--color-primary-soft)' : stat ? 'var(--color-bg-card)' : 'var(--color-bg-secondary)',
                boxShadow: isSelected ? 'inset 0 0 0 1px var(--color-primary)' : 'none',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: isSelected ? 800 : 650 }}>{day}</span>
              {stat && (
                <span style={{
                  fontSize: 10, fontWeight: 800, lineHeight: 1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: stat.net >= 0 ? 'var(--color-income-text)' : 'var(--color-expense-text)',
                }}>
                  {compactAmount(stat.net)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div style={dayDetail} aria-live="polite">
        <div>
          <strong style={{ display: 'block', fontSize: 13 }}>{Number(yearMonth.slice(5))}月{selectedDay}日</strong>
          <span style={{ fontSize: 10, color: 'var(--color-text-small)' }}>{selected ? `${selected.count} 笔记录` : '暂无收支'}</span>
        </div>
        <div style={{ display: 'flex', gap: 14, textAlign: 'right' }}>
          <div><span style={detailLabel}>收入</span><strong style={{ ...detailValue, color: 'var(--color-income-text)' }}>¥{fmt(selected?.income ?? 0)}</strong></div>
          <div><span style={detailLabel}>支出</span><strong style={{ ...detailValue, color: 'var(--color-expense-text)' }}>¥{fmt(selected?.expense ?? 0)}</strong></div>
          <div><span style={detailLabel}>净额</span><strong style={detailValue}>{compactAmount(selected?.net ?? 0)}</strong></div>
        </div>
      </div>
    </section>
  )
}

function TrendChart({ trends, period, budget }: { trends: MonthTrend[]; period: Period; budget: number | null }) {
  const visible = period === 'year' ? trends.slice(-12) : trends.slice(-6)
  const max = Math.max(...visible.map(item => item.expense), budget ?? 0, 1)
  return (
    <section className="surface" style={section}>
      <h2 style={sectionTitle}>{period === 'year' ? '近 1 年' : '近 6 个月'}</h2>
      <div style={{ display: 'flex', gap: period === 'year' ? 3 : 6, height: 112, alignItems: 'flex-end' }}>
        {visible.map(item => {
          const height = item.expense ? Math.max(4, Math.round(item.expense / max * 72)) : 2
          return (
            <div key={item.yearMonth} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              <div style={{ height: 76, display: 'flex', alignItems: 'flex-end' }}>
                <div title={`支出 ¥${fmt(item.expense)}`} style={{ width: '100%', height, borderRadius: '5px 5px 2px 2px', background: item.yearMonth === visible[visible.length - 1]?.yearMonth ? 'var(--color-primary)' : 'var(--color-text-tertiary)', opacity: item.yearMonth === visible[visible.length - 1]?.yearMonth ? 0.9 : 0.42 }} />
              </div>
              <span style={{ fontSize: period === 'year' ? 8 : 10, color: 'var(--color-text-small)' }}>{item.monthLabel}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function StatsPage() {
  const { currentMonth, setCurrentMonth } = useAppStore()
  const { categoryStats, merchantStats, monthlyTrend, dailyStats = [], totalExpense, totalIncome } = useStats(currentMonth)
  const { categories } = useCategories()
  const { monthlyBudgetAmount } = useBudget()
  const [showPicker, setShowPicker] = useState(false)
  const [period, setPeriod] = useState<Period>('month')
  const [year, month] = currentMonth.split('-')
  const catMap = new Map(categories.map(category => [category.id, category]))
  const balance = totalIncome - totalExpense
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="page-scroll stats-page">
      <nav aria-label="统计月份" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <button type="button" className="icon-button" aria-label="上个月" onClick={() => setCurrentMonth(shiftMonth(currentMonth, -1))} style={arrowBtn}><Icon name="chevron-left" /></button>
        <button type="button" className="pressable-control" aria-label="选择月份" onClick={() => setShowPicker(true)} style={monthBtn}>{year}年{month}月</button>
        <button type="button" className="icon-button" aria-label="下个月" onClick={() => setCurrentMonth(shiftMonth(currentMonth, 1))} style={arrowBtn}><Icon name="chevron-right" /></button>
      </nav>

      <div role="group" aria-label="统计周期" style={periodControl}>
        {([['month', '1 个月'], ['halfYear', '6 个月'], ['year', '1 年']] as const).map(([value, label]) => (
          <button key={value} className="pressable-control" type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} style={{ ...periodButton, ...(period === value ? periodButtonActive : {}) }}>{label}</button>
        ))}
      </div>

      <section aria-label="本月收支概览" className="surface" style={summaryBand}>
        <div><span style={cardLabel}>支出</span><strong style={{ ...cardValue, color: 'var(--color-expense-text)' }}>¥{fmt(totalExpense)}</strong></div>
        <div><span style={cardLabel}>收入</span><strong style={{ ...cardValue, color: 'var(--color-income-text)' }}>¥{fmt(totalIncome)}</strong></div>
        <div><span style={cardLabel}>净额</span><strong style={cardValue}>{balance >= 0 ? '+' : '−'}¥{fmt(Math.abs(balance))}</strong></div>
      </section>

      <motion.div
        className="stats-period-panel motion-enter"
        key={period}
        initial={{ opacity: 0, transform: shouldReduceMotion ? 'translateY(0)' : 'translateY(4px)' }}
        animate={{ opacity: 1, transform: 'translateY(0)' }}
        transition={{ duration: shouldReduceMotion ? 0.16 : 0.18, ease: [0.23, 1, 0.32, 1] }}
      >
        {period === 'month'
          ? <DailyCalendar yearMonth={currentMonth} stats={dailyStats} />
          : <TrendChart trends={monthlyTrend} period={period} budget={monthlyBudgetAmount ?? null} />}
      </motion.div>

      <BudgetSection />

      <section className="surface" style={section}>
        <h2 style={sectionTitle}>本月支出分类</h2>
        {categoryStats.length === 0 ? <div style={empty}>本月暂无支出记录</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categoryStats.map(stat => {
              const assigned = catMap.get(stat.categoryId)
              const category = assigned?.type === 'expense' ? assigned : catMap.get('sys-other-ex')
              return (
                <div key={stat.categoryId}>
                  <div style={breakdownRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={rowIcon}><Icon name={categoryIconName(category)} size={18} /></span><span style={rowName}>{category?.name ?? '未分类'}</span></div>
                    <div style={{ display: 'flex', gap: 8 }}><span style={percentage}>{Math.round(stat.pct * 100)}%</span><strong style={expenseAmount}>¥{fmt(stat.amount)}</strong></div>
                  </div>
                  <div style={track}><div style={{ ...fill, width: `${stat.pct * 100}%` }} /></div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {merchantStats.length > 0 && <section className="surface" style={section}>
        <h2 style={sectionTitle}>本月商户消费</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{merchantStats.map(stat => <div key={stat.name}>
          <div style={breakdownRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><span style={rowIcon}><Icon name="wallet" size={18} /></span><div style={{ minWidth: 0 }}><span style={{ ...rowName, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stat.name}</span><span style={{ fontSize: 10, color: 'var(--color-text-small)' }}>{stat.count} 笔</span></div></div>
            <div style={{ display: 'flex', flexShrink: 0, gap: 8 }}><span style={percentage}>{Math.round(stat.pct * 100)}%</span><strong style={expenseAmount}>¥{fmt(stat.amount)}</strong></div>
          </div>
          <div style={track}><div style={{ ...fill, width: `${stat.pct * 100}%` }} /></div>
        </div>)}</div>
      </section>}

      {showPicker && <MonthPickerSheet value={currentMonth} onChange={setCurrentMonth} onClose={() => setShowPicker(false)} />}
    </div>
  )
}

const arrowBtn: React.CSSProperties = { color: 'var(--color-text-secondary)', minHeight: 44, minWidth: 44 }
const monthBtn: React.CSSProperties = { background: 'none', border: 'none', borderRadius: 'var(--radius-control)', minHeight: 44, padding: '2px 12px', cursor: 'pointer', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }
const periodControl: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: 3, marginTop: 8, background: 'var(--color-bg-secondary)', borderRadius: 12 }
const periodButton: React.CSSProperties = { minHeight: 44, border: 0, borderRadius: 9, background: 'transparent', color: 'var(--color-text-small)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }
const periodButtonActive: React.CSSProperties = { background: 'var(--color-bg-card)', color: 'var(--color-primary-strong)', boxShadow: '0 2px 8px rgb(61 68 55 / 8%)' }
const summaryBand: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 8, minHeight: 52, padding: '9px 12px', textAlign: 'center' }
const cardLabel: React.CSSProperties = { display: 'block', fontSize: 11, color: 'var(--color-text-small)', fontWeight: 650, marginBottom: 2 }
const cardValue: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--color-text)', overflowWrap: 'anywhere' }
const section: React.CSSProperties = { marginTop: 8, padding: 16 }
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 14 }
const weekGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginBottom: 5 }
const weekLabel: React.CSSProperties = { textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-text-small)' }
const calendarGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }
const dayCell: React.CSSProperties = { minHeight: 44, minWidth: 0, padding: '4px 1px', border: '1px solid var(--color-border)', borderRadius: 9, color: 'var(--color-text)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }
const dayDetail: React.CSSProperties = { minHeight: 56, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
const detailLabel: React.CSSProperties = { display: 'block', fontSize: 10, color: 'var(--color-text-small)', marginBottom: 2 }
const detailValue: React.CSSProperties = { display: 'block', fontSize: 10, color: 'var(--color-text)' }
const empty: React.CSSProperties = { textAlign: 'center', padding: '24px 0', color: 'var(--color-text-small)', fontSize: 13 }
const breakdownRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }
const rowIcon: React.CSSProperties = { alignItems: 'center', color: 'var(--color-primary-strong)', display: 'inline-flex', justifyContent: 'center' }
const rowName: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }
const percentage: React.CSSProperties = { fontSize: 11, color: 'var(--color-text-small)' }
const expenseAmount: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: 'var(--color-expense-text)' }
const track: React.CSSProperties = { height: 5, borderRadius: 3, background: 'var(--color-bg-secondary)', overflow: 'hidden' }
const fill: React.CSSProperties = { height: '100%', borderRadius: 3, background: 'var(--color-primary)', opacity: 0.68 }

import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'

interface Props {
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export function MonthPickerSheet({ value, onChange, onClose }: Props) {
  const [selectedYear, selectedMonth] = value.split('-').map(Number)
  const [pickerYear, setPickerYear] = useState(selectedYear)

  const select = (month: number) => {
    onChange(`${pickerYear}-${String(month).padStart(2, '0')}`)
    onClose()
  }

  return (
    <Sheet open title="选择月份" description={`${pickerYear}年`} onClose={onClose}>
      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <button type="button" className="icon-button" aria-label="上一年" onClick={() => setPickerYear((year) => year - 1)} style={navButtonStyle}>
          <Icon name="chevron-left" />
        </button>
        <span aria-live="polite" style={{ color: 'var(--color-text)', fontSize: 18, fontWeight: 800 }}>{pickerYear}年</span>
        <button type="button" className="icon-button" aria-label="下一年" onClick={() => setPickerYear((year) => year + 1)} style={navButtonStyle}>
          <Icon name="chevron-right" />
        </button>
      </div>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {MONTHS.map((label, index) => {
          const month = index + 1
          const active = pickerYear === selectedYear && month === selectedMonth
          return (
            <button
              key={month}
              type="button"
              aria-pressed={active}
              onClick={() => select(month)}
              style={{
                background: active ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-control)',
                color: active ? 'var(--color-on-primary)' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: active ? 800 : 550,
                minHeight: 44,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

const navButtonStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
}

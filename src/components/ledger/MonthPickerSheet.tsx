import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  value: string   // 'YYYY-MM'
  onChange: (value: string) => void
  onClose: () => void
}

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

export function MonthPickerSheet({ value, onChange, onClose }: Props) {
  const [selYear, selMonth] = value.split('-').map(Number)
  const [pickerYear, setPickerYear] = useState(selYear)

  const select = (m: number) => {
    onChange(`${pickerYear}-${String(m).padStart(2, '0')}`)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--color-bg-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button onClick={() => setPickerYear(y => y - 1)} style={navBtn}>‹</button>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>{pickerYear}年</span>
            <button onClick={() => setPickerYear(y => y + 1)} style={navBtn}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {MONTHS.map((label, i) => {
              const m = i + 1
              const active = pickerYear === selYear && m === selMonth
              return (
                <button
                  key={m}
                  onClick={() => select(m)}
                  style={{
                    padding: '11px 0',
                    borderRadius: 12,
                    border: 'none',
                    fontSize: 14,
                    fontWeight: active ? 800 : 500,
                    cursor: 'pointer',
                    background: active ? 'var(--color-tab-active)' : 'var(--color-bg-secondary)',
                    color: active ? 'var(--color-fab-text)' : 'var(--color-text)',
                    transition: 'background 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const navBtn: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: 'none',
  borderRadius: 10,
  width: 38,
  height: 38,
  fontSize: 20,
  cursor: 'pointer',
  color: 'var(--color-text)',
  fontWeight: 700,
}

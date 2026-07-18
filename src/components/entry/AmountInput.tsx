import { forwardRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}

export const AmountInput = forwardRef<HTMLDivElement, Props>(function AmountInput({ value, onChange, invalid = false, describedBy }, ref) {
  const handleKey = (key: string) => {
    if (key === 'DEL') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.' && value.includes('.')) return
    if (value.split('.')[1]?.length >= 2) return
    if (value === '0' && key !== '.') {
      onChange(key)
      return
    }
    onChange(value + key)
  }

  const displayValue = value || '0'
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL']

  return (
    <div>
      <div
        ref={ref}
        tabIndex={-1}
        aria-label="金额输入"
        aria-live="polite"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        style={{ margin: '8px 0 16px', textAlign: 'center' }}
      >
        <div style={{ color: 'var(--color-text-small)', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginBottom: 4 }}>金额</div>
        <div style={{ color: 'var(--color-text)', fontSize: 'clamp(36px, 12vw, 52px)', fontWeight: 900, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
          ¥{displayValue}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 7, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {keys.map((key) => {
          const isDelete = key === 'DEL'
          return (
            <button
              key={key}
              type="button"
              aria-label={isDelete ? '删除一位' : undefined}
              onClick={() => handleKey(key)}
              style={{
                alignItems: 'center',
                background: isDelete ? 'var(--color-bg-secondary)' : 'var(--color-input-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                display: 'inline-flex',
                fontSize: 20,
                fontWeight: 650,
                justifyContent: 'center',
                minHeight: 44,
                padding: '8px 0',
                touchAction: 'manipulation',
              }}
            >
              {isDelete ? (
                <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 5H9l-7 7 7 7h12z" />
                  <path d="m12 9 6 6M18 9l-6 6" />
                </svg>
              ) : key}
            </button>
          )
        })}
      </div>
    </div>
  )
})

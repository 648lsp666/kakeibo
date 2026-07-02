interface Props {
  value: string
  onChange: (v: string) => void
}

export function AmountInput({ value, onChange }: Props) {
  const handleKey = (key: string) => {
    if (key === 'DEL') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.' && value.includes('.')) return
    if (value.split('.')[1]?.length >= 2) return
    if (value === '0' && key !== '.') { onChange(key); return }
    onChange(value + key)
  }

  const displayValue = value || '0'
  const keys = ['1','2','3','4','5','6','7','8','9','.','0','DEL']

  return (
    <div>
      <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>金额</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--color-text)', lineHeight: 1.1 }}>
          ¥{displayValue}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {keys.map(k => (
          <button
            key={k}
            onClick={() => handleKey(k)}
            style={{
              padding: '14px 0',
              background: k === 'DEL' ? 'var(--color-bg-secondary)' : 'var(--color-input-bg)',
              border: 'none',
              borderRadius: 10,
              fontSize: k === 'DEL' ? 18 : 20,
              fontWeight: 600,
              color: 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            {k === 'DEL' ? '⌫' : k}
          </button>
        ))}
      </div>
    </div>
  )
}

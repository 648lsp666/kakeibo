import { useState } from 'react'
import type { TransactionType } from '../../types'

const EMOJI_OPTIONS = ['🍜','🛒','🚌','🎮','🏠','💊','📚','📦','☕','🍵','✈️','🎁','💄','🐶','📱','🏋️','🎵','📷']

interface Props {
  onSave: (data: { name: string; emoji: string; type: TransactionType }) => void
  onCancel: () => void
}

export function CategoryForm({ onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [type, setType] = useState<TransactionType>('expense')

  const handleSave = () => {
    if (!name.trim()) { alert('请输入分类名称'); return }
    onSave({ name: name.trim(), emoji, type })
  }

  return (
    <div style={{ background: 'var(--color-bg-card)', borderRadius: '20px 20px 0 0', padding: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', marginBottom: 16 }}>新建分类</div>

      <div style={{ display: 'flex', background: 'var(--color-toggle-inactive)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
        {(['expense', 'income'] as TransactionType[]).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              flex: 1, padding: '8px 0',
              background: type === t ? 'var(--color-toggle-active)' : 'transparent',
              color: type === t ? 'var(--color-fab-text)' : 'var(--color-text-secondary)',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t === 'expense' ? '支出' : '收入'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 14 }}>
        {EMOJI_OPTIONS.map(e => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            style={{
              fontSize: 22, padding: '6px 0',
              background: emoji === e ? 'var(--color-bg-secondary)' : 'transparent',
              border: emoji === e ? '2px solid var(--color-tab-active)' : '2px solid transparent',
              borderRadius: 10, cursor: 'pointer',
            }}
          >
            {e}
          </button>
        ))}
      </div>

      <input
        placeholder="分类名称"
        value={name}
        onChange={e => setName(e.target.value)}
        style={{ width: '100%', background: 'var(--color-input-bg)', border: 'none', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: 'var(--color-text)', marginBottom: 14, outline: 'none' }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '12px 0', background: 'var(--color-bg-secondary)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', cursor: 'pointer' }}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          style={{ flex: 2, padding: '12px 0', background: 'var(--color-tab-active)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, color: 'var(--color-fab-text)', cursor: 'pointer' }}
        >
          保存
        </button>
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
import type { TransactionType } from '../../types'
import { Icon, type IconName } from '../ui/Icon'

const CATEGORY_ICON_OPTIONS = [
  'food', 'cart', 'transit', 'game', 'home', 'medical', 'book', 'category',
  'coffee', 'tea', 'plane', 'gift', 'beauty', 'pet', 'phone', 'fitness', 'music', 'camera',
] as const satisfies readonly IconName[]

const ICON_LABELS: Record<(typeof CATEGORY_ICON_OPTIONS)[number], string> = {
  food: '餐饮',
  cart: '购物',
  transit: '交通',
  game: '娱乐',
  home: '居家',
  medical: '医疗',
  book: '学习',
  category: '其他',
  coffee: '咖啡',
  tea: '茶饮',
  plane: '旅行',
  gift: '礼物',
  beauty: '美妆',
  pet: '宠物',
  phone: '通讯',
  fitness: '健身',
  music: '音乐',
  camera: '摄影',
}

interface Props {
  onSave: (data: { name: string; icon: IconName; type: TransactionType }) => void | Promise<void>
  onCancel: () => void
}

export function CategoryForm({ onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<IconName>('category')
  const [type, setType] = useState<TransactionType>('expense')
  const [validationError, setValidationError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    if (savingRef.current) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setValidationError('请输入分类名称')
      nameRef.current?.focus()
      return
    }
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      await onSave({ name: trimmedName, icon, type })
    } catch {
      setSaveError('保存失败，请稍后重试')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div aria-busy={saving}>
      <div
        role="group"
        aria-label="分类类型"
        style={{ display: 'flex', background: 'var(--color-bg-secondary)', borderRadius: 12, padding: 3, marginBottom: 18 }}
      >
        {(['expense', 'income'] as TransactionType[]).map((optionType) => (
          <button
            key={optionType}
            type="button"
            disabled={saving}
            aria-pressed={type === optionType}
            onClick={() => setType(optionType)}
            style={{
              flex: 1,
              minHeight: 'var(--tap-size)',
              background: type === optionType ? 'var(--color-primary)' : 'transparent',
              color: type === optionType ? 'var(--color-on-primary)' : 'var(--color-text)',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {optionType === 'expense' ? '支出' : '收入'}
          </button>
        ))}
      </div>

      <div id="category-icon-label" style={fieldLabel}>选择图标</div>
      <div
        role="group"
        aria-labelledby="category-icon-label"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(var(--tap-size), 1fr))', gap: 8, marginBottom: 18 }}
      >
        {CATEGORY_ICON_OPTIONS.map((optionIcon) => (
          <button
            key={optionIcon}
            type="button"
            disabled={saving}
            aria-label={`${ICON_LABELS[optionIcon]}图标`}
            aria-pressed={icon === optionIcon}
            onClick={() => setIcon(optionIcon)}
            style={{
              alignItems: 'center',
              background: icon === optionIcon ? 'var(--color-primary-soft)' : 'var(--color-bg-secondary)',
              border: icon === optionIcon ? '2px solid var(--color-primary-strong)' : '2px solid transparent',
              borderRadius: 12,
              color: icon === optionIcon ? 'var(--color-primary-strong)' : 'var(--color-text)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              minHeight: 'var(--tap-size)',
              minWidth: 'var(--tap-size)',
            }}
          >
            <Icon name={optionIcon} size={20} />
          </button>
        ))}
      </div>

      <label htmlFor="category-name" style={fieldLabel}>分类名称</label>
      <input
        ref={nameRef}
        id="category-name"
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setValidationError('')
          setSaveError('')
        }}
        placeholder="例如：早餐"
        aria-invalid={Boolean(validationError)}
        aria-describedby={validationError ? 'category-name-error' : undefined}
        disabled={saving}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 'var(--tap-size)',
          background: 'var(--color-input-bg)',
          border: validationError ? '1px solid var(--color-expense)' : '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 14,
          color: 'var(--color-text)',
          outline: 'none',
        }}
      />
      {validationError && (
        <div id="category-name-error" role="alert" style={{ color: 'var(--color-expense-text)', fontSize: 12, fontWeight: 600, marginTop: 7 }}>
          {validationError}
        </div>
      )}
      {saveError && (
        <div role="alert" style={{ color: 'var(--color-expense-text)', fontSize: 12, fontWeight: 600, marginTop: 7 }}>
          {saveError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button type="button" disabled={saving} onClick={onCancel} className="secondary-button" style={{ flex: 1 }}>
          取消
        </button>
        <button type="button" aria-label={saving ? '保存中…' : '保存分类'} disabled={saving} onClick={handleSave} className="primary-button" style={{ flex: 2 }}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}

const fieldLabel: React.CSSProperties = {
  color: 'var(--color-text-small)',
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  marginBottom: 8,
}

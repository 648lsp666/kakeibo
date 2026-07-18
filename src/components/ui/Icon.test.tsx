import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, categoryIconName } from './Icon'
import type { Category } from '../../types'

const category = (patch: Partial<Category>): Category => ({
  id: 'custom', name: '测试', type: 'expense', isSystem: false,
  sortOrder: 0, createdAt: '2026-07-15T00:00:00.000Z', ...patch,
})

describe('Icon', () => {
  it('renders a labelled rounded-line svg', () => {
    render(<Icon name="food" label="餐饮" />)
    expect(screen.getByRole('img', { name: '餐饮' })).toHaveAttribute('viewBox', '0 0 24 24')
  })

  it('hides decorative icons from assistive technology', () => {
    const { container } = render(<Icon name="ledger" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the transfer category icon', () => {
    render(<Icon name="transfer" label="转账" />)
    expect(screen.getByRole('img', { name: '转账' })).toBeInTheDocument()
  })

  it('prefers a stable icon name, maps legacy emoji, and falls back', () => {
    expect(categoryIconName(category({ icon: 'coffee', emoji: '🍜' }))).toBe('coffee')
    expect(categoryIconName(category({ emoji: '🍜' }))).toBe('food')
    expect(categoryIconName(category({ emoji: 'unknown' }))).toBe('category')
  })
})

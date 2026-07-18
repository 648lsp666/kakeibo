import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Transaction } from '../../types'
import { CSVPreviewSheet } from './CSVPreviewSheet'

const transactions: Transaction[] = Array.from({ length: 21 }, (_, index) => ({
  id: `transaction-${index}`,
  amount: index + 1,
  type: 'expense',
  categoryId: 'sys-food',
  note: `记录 ${index + 1}`,
  date: '2026-07-15',
  source: 'wechat',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
}))

it('uses the semantic small-text token for preview metadata and microcopy', () => {
  render(
    <CSVPreviewSheet
      transactions={transactions}
      source="wechat"
      duplicateIds={new Set(['transaction-0'])}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      importing={false}
    />,
  )

  expect(screen.getAllByText('2026-07-15')[0]).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(screen.getByText('记录 1')).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(screen.getByText('-¥1.00')).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(screen.getByText('可能重复')).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(screen.getByText('… 还有 1 条')).toHaveStyle({ color: 'var(--color-text-small)' })
})

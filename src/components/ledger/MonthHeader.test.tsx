import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MonthHeader } from './MonthHeader'

it('provides 44px touch targets for every month control', () => {
  render(
    <MonthHeader
      yearMonth="2026-07"
      summary={{ income: 200, expense: 100, balance: 100 }}
      importButton={<button type="button">导入 CSV</button>}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onPickMonth={vi.fn()}
    />,
  )

  expect(screen.getByRole('button', { name: '上个月' })).toHaveStyle({ minWidth: '44px', minHeight: '44px' })
  expect(screen.getByRole('button', { name: '选择月份，当前为2026年07月' })).toHaveStyle({ minHeight: '44px' })
  expect(screen.getByRole('button', { name: '下个月' })).toHaveStyle({ minWidth: '44px', minHeight: '44px' })
})

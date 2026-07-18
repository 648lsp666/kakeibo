import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { TabBar } from './TabBar'
import { useAppStore } from '../../store/appStore'

beforeEach(() => useAppStore.setState({ activeTab: 'ledger', isAddSheetOpen: false }))

it('switches tabs and exposes the active page', async () => {
  render(<TabBar />)
  await userEvent.click(screen.getByRole('button', { name: '统计' }))
  expect(useAppStore.getState().activeTab).toBe('stats')
  expect(screen.getByRole('button', { name: '统计' })).toHaveAttribute('aria-current', 'page')
})

it('opens add entry from the central action', async () => {
  render(<TabBar />)
  const addButton = screen.getByRole('button', { name: '记一笔' })
  expect(addButton).toHaveStyle({ boxShadow: 'var(--shadow-fab)' })
  await userEvent.click(addButton)
  expect(useAppStore.getState().isAddSheetOpen).toBe(true)
})

it('uses the contrast-safe small-text token for inactive tab labels', () => {
  render(<TabBar />)

  expect(screen.getByRole('button', { name: '账单' })).toHaveStyle({ color: 'var(--color-primary-strong)' })
  for (const label of ['统计', '分类', '设置']) {
    expect(screen.getByRole('button', { name: label })).toHaveStyle({ color: 'var(--color-text-small)' })
  }
})

it('opts every navigation action into restrained press feedback', () => {
  render(<TabBar />)
  for (const label of ['账单', '统计', '记一笔', '分类', '设置']) {
    expect(screen.getByRole('button', { name: label })).toHaveClass('tab-button')
  }
})

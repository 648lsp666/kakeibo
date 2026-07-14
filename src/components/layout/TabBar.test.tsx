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
  await userEvent.click(screen.getByRole('button', { name: '记一笔' }))
  expect(useAppStore.getState().isAddSheetOpen).toBe(true)
})

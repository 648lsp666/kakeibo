import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CSVImportButton } from './CSVImportButton'

it('renders an accessible 44px import action with a local icon and supported file types', () => {
  const { container } = render(<CSVImportButton onParsed={vi.fn()} onError={vi.fn()} />)

  const button = screen.getByRole('button', { name: '导入 CSV' })
  expect(button).toHaveTextContent('导入 CSV')
  expect(button).not.toHaveTextContent('📥')
  expect(button).toHaveStyle({ minHeight: '44px' })
  expect(button).toHaveStyle({ color: 'var(--color-text-small)' })
  expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

  const input = container.querySelector('input[type="file"]')
  expect(input).toHaveAttribute('accept', '.csv,.xlsx,.xls')
})

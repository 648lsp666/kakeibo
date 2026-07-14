import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { Sheet } from './Sheet'

const motionMock = vi.hoisted(() => ({
  reducedMotion: vi.fn(),
  overlayProps: [] as Array<Record<string, unknown>>,
  surfaceProps: [] as Array<Record<string, unknown>>,
}))

const last = (items: Array<Record<string, unknown>>) => items[items.length - 1]

vi.mock('framer-motion', () => {
  const renderMotionElement = (
    tag: 'div' | 'section',
    testId: string,
    capturedProps: Array<Record<string, unknown>>,
  ) => function MotionElement({ initial, animate, exit, transition, children, ...props }: Record<string, unknown>) {
    capturedProps.push({ initial, animate, exit, transition })
    return React.createElement(tag, { ...props, 'data-testid': testId }, children as React.ReactNode)
  }

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: motionMock.reducedMotion,
    motion: {
      div: renderMotionElement('div', 'sheet-overlay', motionMock.overlayProps),
      section: renderMotionElement('section', 'sheet-surface', motionMock.surfaceProps),
    },
  }
})

beforeEach(() => {
  motionMock.reducedMotion.mockReset()
  motionMock.overlayProps.length = 0
  motionMock.surfaceProps.length = 0
})

it('omits overlay and surface motion when reduced motion is requested', () => {
  motionMock.reducedMotion.mockReturnValue(true)

  render(<Sheet open title="测试" onClose={() => undefined}>内容</Sheet>)

  expect(screen.getByTestId('sheet-overlay')).toBeInTheDocument()
  expect(last(motionMock.overlayProps)).toEqual({
    initial: undefined,
    animate: undefined,
    exit: undefined,
    transition: undefined,
  })
  expect(last(motionMock.surfaceProps)).toEqual({
    initial: undefined,
    animate: undefined,
    exit: undefined,
    transition: undefined,
  })
})

it('keeps the existing spring and fade motion by default', () => {
  motionMock.reducedMotion.mockReturnValue(false)

  render(<Sheet open title="测试" onClose={() => undefined}>内容</Sheet>)

  expect(last(motionMock.overlayProps)).toEqual({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  })
  expect(last(motionMock.surfaceProps)).toEqual({
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: { type: 'spring', damping: 30, stiffness: 300 },
  })
})

it('uses the semantic small-text token for the description', () => {
  motionMock.reducedMotion.mockReturnValue(false)

  render(<Sheet open title="测试" description="说明文字" onClose={() => undefined}>内容</Sheet>)

  expect(screen.getByText('说明文字')).toHaveStyle({
    color: 'var(--color-text-small)',
  })
})

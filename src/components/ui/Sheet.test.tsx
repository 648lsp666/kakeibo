import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

it('keeps the surface fixed while only the body scrolls and the footer respects safe areas', () => {
  motionMock.reducedMotion.mockReturnValue(false)
  render(<Sheet open title="测试" onClose={() => undefined} footer={<button>保存</button>}>内容</Sheet>)

  expect(screen.getByRole('dialog')).toHaveStyle({ maxHeight: '90dvh', overflow: 'hidden', display: 'flex' })
  expect(screen.getByText('内容').closest('[data-sheet-body]')).toHaveStyle({ overflowY: 'auto', overscrollBehavior: 'contain' })
  expect(screen.getByText('保存').closest('[data-sheet-footer]')).toHaveStyle({ flexShrink: '0' })
})

it('moves focus to the preferred autofocus control when opened', () => {
  motionMock.reducedMotion.mockReturnValue(false)

  render(
    <Sheet open title="测试" onClose={() => undefined}>
      <button type="button">普通操作</button>
      <input aria-label="首选输入" data-autofocus />
    </Sheet>,
  )

  expect(screen.getByLabelText('首选输入')).toHaveFocus()
})

it('wraps focus from the last control to the first with Tab', async () => {
  motionMock.reducedMotion.mockReturnValue(false)
  const user = userEvent.setup()

  render(
    <Sheet open title="测试" onClose={() => undefined}>
      <button type="button">第一个操作</button>
      <button type="button">最后一个操作</button>
    </Sheet>,
  )

  const first = screen.getByRole('button', { name: '关闭' })
  const last = screen.getByRole('button', { name: '最后一个操作' })
  last.focus()
  await user.tab()

  expect(first).toHaveFocus()
})

it('wraps focus from the first control to the last with Shift+Tab', async () => {
  motionMock.reducedMotion.mockReturnValue(false)
  const user = userEvent.setup()

  render(
    <Sheet open title="测试" onClose={() => undefined}>
      <button type="button">第一个操作</button>
      <button type="button">最后一个操作</button>
    </Sheet>,
  )

  const first = screen.getByRole('button', { name: '关闭' })
  const last = screen.getByRole('button', { name: '最后一个操作' })
  first.focus()
  await user.tab({ shift: true })

  expect(last).toHaveFocus()
})

it('closes on Escape and restores focus to the previously active element', async () => {
  motionMock.reducedMotion.mockReturnValue(false)
  const user = userEvent.setup()

  function Harness() {
    const [open, setOpen] = React.useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>打开弹层</button>
        <Sheet open={open} title="测试" onClose={() => setOpen(false)}>
          <input aria-label="弹层输入" data-autofocus />
        </Sheet>
      </>
    )
  }

  render(<Harness />)
  const trigger = screen.getByRole('button', { name: '打开弹层' })
  await user.click(trigger)
  expect(screen.getByLabelText('弹层输入')).toHaveFocus()

  await user.keyboard('{Escape}')

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('restores focus when the open Sheet unmounts', () => {
  motionMock.reducedMotion.mockReturnValue(false)
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()

  const { unmount } = render(
    <Sheet open title="测试" onClose={() => undefined}>
      <input aria-label="弹层输入" data-autofocus />
    </Sheet>,
  )
  expect(screen.getByLabelText('弹层输入')).toHaveFocus()

  unmount()

  expect(trigger).toHaveFocus()
  trigger.remove()
})

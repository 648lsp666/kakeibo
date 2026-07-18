import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from './Icon'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface SheetProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  zIndex?: number
  closeDisabled?: boolean
  busy?: boolean
}

export function Sheet({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  zIndex = 200,
  closeDisabled = false,
  busy = false,
}: SheetProps): React.ReactNode {
  const titleId = useId()
  const descriptionId = useId()
  const shouldReduceMotion = useReducedMotion()
  const surfaceRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const surface = surfaceRef.current
    const autofocusTarget = surface?.querySelector<HTMLElement>('[data-autofocus]')
    const firstFocusable = surface?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    const focusTarget = autofocusTarget ?? firstFocusable ?? surface

    focusTarget?.focus()

    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!closeDisabled) onClose()
      return
    }

    if (event.key !== 'Tab') return

    const surface = surfaceRef.current
    if (!surface) return

    const focusable = Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((element) => !element.matches(':disabled') && element.tabIndex >= 0)

    if (focusable.length === 0) {
      event.preventDefault()
      surface.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleBodyFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !window.visualViewport) return
    const viewportBottom = window.visualViewport.offsetTop + window.visualViewport.height
    if (target.getBoundingClientRect().bottom > viewportBottom) {
      target.scrollIntoView({ block: 'nearest' })
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
          onClick={() => { if (!closeDisabled) onClose() }}
          style={{
            alignItems: 'flex-end',
            background: 'var(--color-overlay)',
            display: 'flex',
            inset: 0,
            position: 'fixed',
            zIndex,
          }}
        >
          <motion.section
            ref={surfaceRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            aria-busy={busy}
            tabIndex={-1}
            initial={shouldReduceMotion ? undefined : { y: '100%' }}
            animate={shouldReduceMotion ? undefined : { y: 0 }}
            exit={shouldReduceMotion ? undefined : { y: '100%' }}
            transition={shouldReduceMotion ? undefined : { type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
            style={{
              background: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-hero) var(--radius-hero) 0 0',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              margin: '0 auto',
              maxHeight: '90dvh',
              maxWidth: 430,
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <div style={{ flexShrink: 0, padding: '10px 20px 0' }}>
              <div aria-hidden="true" style={{ background: 'var(--color-border)', borderRadius: 999, height: 4, margin: '0 auto 10px', width: 40 }} />
            <header style={{ alignItems: 'flex-start', display: 'flex', gap: 12, paddingBottom: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id={titleId} style={{ color: 'var(--color-text)', fontSize: 18, fontWeight: 800 }}>
                  {title}
                </h2>
                {description && (
                  <p
                    id={descriptionId}
                    style={{ color: 'var(--color-text-small)', fontSize: 13, lineHeight: 1.5, marginTop: 5 }}
                  >
                    {description}
                  </p>
                )}
              </div>
              <button type="button" className="icon-button" aria-label="关闭" disabled={closeDisabled} onClick={onClose}>
                <Icon name="close" />
              </button>
            </header>
            </div>
            <div data-sheet-body onFocus={handleBodyFocus} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 20px 20px', WebkitOverflowScrolling: 'touch' }}>{children}</div>
            {footer && <footer data-sheet-footer style={{ background: 'var(--color-bg-elevated)', borderTop: '1px solid var(--color-border)', flexShrink: 0, padding: '16px 20px max(16px, env(safe-area-inset-bottom))' }}>{footer}</footer>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

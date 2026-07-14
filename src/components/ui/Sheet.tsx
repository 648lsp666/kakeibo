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
}

export function Sheet({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  zIndex = 200,
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
      onClose()
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
          onClick={onClose}
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
              margin: '0 auto',
              maxHeight: '90vh',
              maxWidth: 430,
              overflowY: 'auto',
              padding: '10px 20px max(20px, env(safe-area-inset-bottom))',
              width: '100%',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                background: 'var(--color-border)',
                borderRadius: 999,
                height: 4,
                margin: '0 auto 10px',
                width: 40,
              }}
            />
            <header style={{ alignItems: 'flex-start', display: 'flex', gap: 12, marginBottom: 18 }}>
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
              <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
                <Icon name="close" />
              </button>
            </header>
            <div>{children}</div>
            {footer && <footer style={{ marginTop: 20 }}>{footer}</footer>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

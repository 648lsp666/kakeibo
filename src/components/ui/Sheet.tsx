import { useId } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon } from './Icon'

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
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={shouldReduceMotion ? undefined : { y: '100%' }}
            animate={shouldReduceMotion ? undefined : { y: 0 }}
            exit={shouldReduceMotion ? undefined : { y: '100%' }}
            transition={shouldReduceMotion ? undefined : { type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(event) => event.stopPropagation()}
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
                    style={{ color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.5, marginTop: 5 }}
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

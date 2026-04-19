import { useEffect, useRef, useState } from 'react'

/**
 * Reveal-on-scroll wrapper using IntersectionObserver.
 *  - `stagger` enables CSS-driven cascade for direct children (uses .sg-stagger).
 *  - `delay` shifts the reveal in ms (handy for heroes that should land after page paint).
 *
 * Always renders a <div>. Cheap by design: no animation libs, no re-renders after the first reveal.
 */
export default function ScrollReveal({
  stagger = false,
  delay = 0,
  threshold = 0.15,
  rootMargin = '0px 0px -10% 0px',
  className = '',
  children,
  ...rest
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delay > 0) {
              const id = window.setTimeout(() => setVisible(true), delay)
              return () => window.clearTimeout(id)
            }
            setVisible(true)
            observer.disconnect()
            return
          }
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [delay, threshold, rootMargin])

  const classes = [
    'sg-reveal',
    stagger ? 'sg-stagger' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div ref={ref} className={classes} data-visible={visible ? 'true' : 'false'} {...rest}>
      {children}
    </div>
  )
}

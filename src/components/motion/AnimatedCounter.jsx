import { useEffect, useRef, useState } from 'react'

/**
 * Counts up from 0 to `value` over `duration` ms once it scrolls into view.
 * `value` may be a number or a numeric string. Non-numeric `value` renders as-is.
 * Use `prefix` / `suffix` for currency or labels.
 */
export default function AnimatedCounter({
  value,
  duration = 1400,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}) {
  const numeric = typeof value === 'number' ? value : parseFloat(String(value))
  const isNumeric = Number.isFinite(numeric)
  const ref = useRef(null)
  const [display, setDisplay] = useState(isNumeric ? 0 : value)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!isNumeric) return
    const node = ref.current
    if (!node) return

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setDisplay(numeric))
      return () => cancelAnimationFrame(id)
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      const id = requestAnimationFrame(() => setDisplay(numeric))
      return () => cancelAnimationFrame(id)
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true
            const start = performance.now()
            const tick = now => {
              const t = Math.min(1, (now - start) / duration)
              const eased = 1 - Math.pow(1 - t, 3)
              setDisplay(numeric * eased)
              if (t < 1) requestAnimationFrame(tick)
              else setDisplay(numeric)
            }
            requestAnimationFrame(tick)
            observer.disconnect()
            return
          }
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [numeric, isNumeric, duration])

  const out = isNumeric
    ? `${prefix}${Number(display).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`
    : value

  return (
    <span ref={ref} className={`nums tabular-nums ${className}`}>
      {out}
    </span>
  )
}

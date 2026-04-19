import { useEffect, useRef } from 'react'

/**
 * Thin top-of-page scroll progress bar.
 * Reads window scroll inside rAF to avoid layout thrash.
 * Honors prefers-reduced-motion by hiding the bar entirely.
 */
export default function ScrollProgress({ className = '' }) {
  const barRef = useRef(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    let raf = 0
    const update = () => {
      raf = 0
      const node = barRef.current
      if (!node) return
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop
      const max = (doc.scrollHeight - window.innerHeight) || 1
      const pct = Math.max(0, Math.min(1, scrollTop / max))
      node.style.transform = `scaleX(${pct})`
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden ${className}`}
    >
      <div
        ref={barRef}
        className="h-full origin-left"
        style={{
          transform: 'scaleX(0)',
          background:
            'linear-gradient(90deg, rgba(217,119,74,0.0) 0%, var(--color-terracotta) 35%, var(--color-terracotta-light) 70%, rgba(217,119,74,0) 100%)',
        }}
      />
    </div>
  )
}

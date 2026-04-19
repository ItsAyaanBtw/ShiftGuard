import { useEffect, useRef } from 'react'

/**
 * Mac-OS-style magnetic button. Pulls toward the cursor on hover.
 * Pure DOM transforms via rAF — no React re-renders mid-motion.
 * Disabled on touch devices and for prefers-reduced-motion.
 *
 * Always renders a <button>. Pass `type="button"` etc. via spread.
 */
export default function MagneticButton({
  strength = 16,
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const isTouch = window.matchMedia?.('(hover: none)').matches
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (isTouch || reduceMotion) return

    let raf = 0
    const onMove = e => {
      const rect = node.getBoundingClientRect()
      const dx = ((e.clientX - rect.left) / rect.width - 0.5) * strength
      const dy = ((e.clientY - rect.top) / rect.height - 0.5) * strength
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      })
    }
    const reset = () => {
      if (raf) cancelAnimationFrame(raf)
      node.style.transform = 'translate3d(0,0,0)'
    }

    node.addEventListener('mousemove', onMove)
    node.addEventListener('mouseleave', reset)
    return () => {
      node.removeEventListener('mousemove', onMove)
      node.removeEventListener('mouseleave', reset)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [strength])

  return (
    <button ref={ref} type={type} className={`sg-magnetic ${className}`} {...rest}>
      {children}
    </button>
  )
}

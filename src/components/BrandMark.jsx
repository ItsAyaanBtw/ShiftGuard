/**
 * BrandMark — the shield logo from `/brand/logo.png`.
 * Shared by every surface (Header, Landing nav, Auth screen, footer).
 */
export default function BrandMark({ size = 28, className = '' }) {
  const px = typeof size === 'number' ? `${size}px` : size
  return (
    <img
      src="/brand/logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.45))',
      }}
    />
  )
}

/**
 * Wordmark — rendered as pure type, not as an image. Two spans stacked inline:
 *   "shift"  in terracotta, heavy weight, rounded Geist
 *   "guard"  in white, Newsreader italic, as an editorial script accent
 * No PNG, no filter, no background rectangle. Scales cleanly at any size.
 *
 * Props:
 *   size: base font-size in px (the two words both key off this).
 *   tone: 'light' (default, for dark surfaces) or 'dark' (for white surfaces).
 */
export function Wordmark({ size = 20, className = '', tone = 'light' }) {
  const px = typeof size === 'number' ? `${size}px` : size
  const guardColor = tone === 'dark' ? '#0f172a' : '#ffffff'
  return (
    <span
      className={`inline-flex items-baseline leading-none select-none ${className}`}
      style={{ fontSize: px }}
      aria-label="ShiftGuard"
    >
      <span
        className="text-terracotta"
        style={{
          fontFamily: "var(--font-sans, 'Geist'), system-ui, sans-serif",
          fontWeight: 800,
          letterSpacing: '-0.025em',
          fontStyle: 'normal',
        }}
      >
        shift
      </span>
      <span
        className="font-display"
        style={{
          color: guardColor,
          fontStyle: 'italic',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          marginLeft: '0.06em',
        }}
      >
        guard
      </span>
    </span>
  )
}

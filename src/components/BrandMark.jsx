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
 * Wordmark — typographic match to the ShiftGuard logo. Rendered as two spans:
 *   "shift"  Fredoka 700 in terracotta. Fredoka is a chunky rounded display
 *            face that matches the bubble letters of the logo's "shift" mark.
 *   "guard"  Caveat 700 in white (or a dark color on light surfaces). Caveat
 *            is a handwritten casual script that matches the flowing tail of
 *            the logo's "guard" word.
 *
 * Both are loaded from Google Fonts via index.html so they show up first
 * paint.
 *
 * Props:
 *   size: base font-size in px (both words key off this).
 *   className: extra Tailwind classes.
 *   tone: 'light' (default, for dark surfaces) or 'dark' (for white surfaces).
 */
export function Wordmark({ size = 22, className = '', tone = 'light' }) {
  const px = typeof size === 'number' ? `${size}px` : size
  const guardColor = tone === 'dark' ? '#0f172a' : '#ffffff'
  return (
    <span
      className={`inline-flex items-baseline leading-none select-none ${className}`}
      style={{ fontSize: px }}
      aria-label="ShiftGuard"
      role="img"
    >
      <span
        style={{
          fontFamily: "'Fredoka', system-ui, sans-serif",
          fontWeight: 700,
          color: '#e8873d',
          letterSpacing: '-0.01em',
          lineHeight: 1,
          fontStyle: 'normal',
        }}
      >
        shift
      </span>
      <span
        style={{
          fontFamily: "'Caveat', 'Brush Script MT', cursive",
          fontWeight: 700,
          color: guardColor,
          fontSize: `${parseFloat(px) * 1.18}px`,
          lineHeight: 1,
          marginLeft: '0.08em',
          transform: 'translateY(0.02em)',
        }}
      >
        guard
      </span>
    </span>
  )
}

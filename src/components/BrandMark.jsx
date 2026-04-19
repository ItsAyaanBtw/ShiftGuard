/**
 * BrandMark. Renders the ShiftGuard shield logo from `/brand/logo.png`. Shared by
 * every surface that wants the shield (Header, Landing nav, Auth screen, footer) so
 * there's one source of truth.
 *
 * Wordmark. Renders the "shiftguard" wordmark PNG. The source art has an orange
 * "shift" + near-black script "guard" on a transparent background, so on dark
 * surfaces we apply `invert(1) hue-rotate(180deg)` which flips luminance (black -> white)
 * while hue-rotating back to approximately the original orange for the "shift" part.
 * That keeps the brand wordmark readable without shipping a separate dark-theme
 * export of the art.
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
 * Wordmark. `height` controls the rendered height; width scales automatically.
 * Pass `tone="dark"` when rendering on a white/light surface (no color flip).
 */
export function Wordmark({ height = 28, className = '', tone = 'light' }) {
  const h = typeof height === 'number' ? `${height}px` : height
  const flip = tone === 'light'
    ? 'invert(1) hue-rotate(180deg) saturate(1.15) brightness(1.05)'
    : 'none'
  return (
    <img
      src="/brand/wordmark.png"
      alt="ShiftGuard"
      className={`shrink-0 select-none ${className}`}
      draggable={false}
      style={{
        height: h,
        width: 'auto',
        filter: flip,
      }}
    />
  )
}

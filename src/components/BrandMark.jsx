/**
 * BrandMark. Renders the ShiftGuard shield logo from `/brand/logo.png` with the right
 * size + drop shadow for a dark background. Single source of truth so every surface
 * that wants the shield (Header, Landing nav, Auth screen, footer) can import one thing.
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

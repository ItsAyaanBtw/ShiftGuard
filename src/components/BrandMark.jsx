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
 * Wordmark — renders the exact `shiftguard` PNG from /brand/wordmark.png
 * with no filter, no tint, no background rectangle, and no padding. The image
 * is shown `object-fit: contain` at a fixed pixel height; width auto-sizes so
 * there's never a phantom white box around the letters.
 *
 * Props:
 *   size: desired pixel height of the wordmark. Width follows.
 *   className: extra Tailwind classes.
 */
export function Wordmark({ size = 28, className = '' }) {
  const px = typeof size === 'number' ? `${size}px` : size
  return (
    <img
      src="/brand/wordmark.png"
      alt="ShiftGuard"
      draggable={false}
      className={`shrink-0 select-none block ${className}`}
      style={{
        height: px,
        width: 'auto',
        objectFit: 'contain',
      }}
    />
  )
}

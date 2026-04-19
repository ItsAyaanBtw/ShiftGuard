/**
 * Infinite kinetic marquee. Renders the items twice for a seamless loop.
 * Use sparingly — one band per page is plenty.
 *
 * Props:
 *  - items: array of strings or nodes
 *  - reverse: bool — flip direction
 *  - className: applied to the outer track
 */
export default function Marquee({ items = [], reverse = false, className = '' }) {
  if (!items.length) return null
  const trackClass = `sg-marquee${reverse ? ' sg-marquee--reverse' : ''}`

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/* Soft fade masks on the edges for a clean loop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
        style={{
          background: 'linear-gradient(to right, var(--color-slate-950), transparent)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
        style={{
          background: 'linear-gradient(to left, var(--color-slate-950), transparent)',
        }}
      />

      <div className={trackClass}>
        {[0, 1].map(loop => (
          <ul
            key={loop}
            className="flex shrink-0 items-center gap-10 px-5"
            aria-hidden={loop === 1 ? 'true' : undefined}
          >
            {items.map((item, i) => (
              <li
                key={`${loop}-${i}`}
                className="flex items-center gap-3 text-slate-400 whitespace-nowrap"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta/60" aria-hidden />
                <span className="text-sm sm:text-base font-medium tracking-tight">{item}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

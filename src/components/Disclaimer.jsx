/**
 * Standard Disclaimer. Rendered on every major screen.
 *
 * Wording tracks the ShiftGuard master document exactly, so we stay in TurboTax category
 * not LegalZoom category. No legal advice, ever.
 */
export default function Disclaimer({ className = '' }) {
  return (
    <p className={`text-xs text-slate-500 leading-relaxed ${className}`}>
      ShiftGuard is a paycheck verification tool. We are not attorneys and do not provide legal advice. For legal
      questions about your pay, consult a licensed attorney or your state labor department.
    </p>
  )
}

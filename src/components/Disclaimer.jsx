export default function Disclaimer({ className = '' }) {
  return (
    <p className={`text-xs text-slate-500 leading-relaxed ${className}`}>
      ShiftGuard is an educational tool. It does not provide legal advice.
      Consult a licensed attorney for legal matters.
    </p>
  )
}

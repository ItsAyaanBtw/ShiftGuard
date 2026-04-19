import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import {
  Mail, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, UserPlus, LogIn,
} from 'lucide-react'
import BrandMark, { Wordmark } from '../components/BrandMark'
import {
  signUp, signIn, listAccounts, setActiveAccount, getActiveAccount, continueAsGuest,
} from '../lib/accounts'

/**
 * Sign up / sign in / continue as guest. The whole authentication system is
 * intentionally local: no backend, no third-party identity provider. Stored
 * passwords are SHA-256 hashed with a per-account salt via SubtleCrypto, but the
 * ShiftGuard threat model still treats the device as the perimeter. We say so.
 *
 * After auth the user lands on `?next=...` (defaults to `/upload`) so the first
 * thing a brand new account sees is the paystub upload flow, per product spec.
 */
export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const next = new URLSearchParams(location.search).get('next') || '/upload'
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'switch'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [accounts, setAccounts] = useState(() => listAccounts())

  useEffect(() => {
    const refresh = () => setAccounts(listAccounts())
    window.addEventListener('shiftguard-account-changed', refresh)
    return () => window.removeEventListener('shiftguard-account-changed', refresh)
  }, [])

  // If a known account is already active, hop straight through.
  useEffect(() => {
    const acct = getActiveAccount()
    if (acct) navigate(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e) {
    e?.preventDefault?.()
    setBusy(true); setError(''); setInfo('')
    try {
      if (mode === 'signup') {
        await signUp({ email, password, displayName })
        setInfo('Account created. Heading to your first upload.')
      } else {
        await signIn({ email, password })
        setInfo('Welcome back.')
      }
      navigate(next, { replace: true })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  function pickAccount(id) {
    setActiveAccount(id)
    navigate(next, { replace: true })
  }

  function asGuest() {
    continueAsGuest()
    navigate(next, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-6 text-white">
            <BrandMark size={30} />
            <Wordmark size={26} />
          </Link>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 glass-edge">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">
              {mode === 'signup'
                ? 'Your paychecks, shifts, and history live in your account. Stored on this device, namespaced per user.'
                : 'Sign in so your paystub history follows you.'}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === 'signup' && (
                <Field label="Display name (optional)">
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Sarah"
                    className={inputCls}
                  />
                </Field>
              )}
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputCls}
                />
              </Field>

              <button
                type="submit"
                disabled={busy}
                className="sg-shine-host w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white font-semibold text-sm disabled:opacity-60"
              >
                {busy
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : mode === 'signup' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />
                }
                {mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-2 text-xs text-green-200">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span>{info}</span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo('') }}
                className="text-terracotta hover:text-terracotta-light font-medium"
              >
                {mode === 'signup' ? 'Have an account? Sign in' : 'Need an account? Sign up'}
              </button>
              <button
                type="button"
                onClick={asGuest}
                className="text-slate-300 hover:text-white"
              >
                Continue as guest
              </button>
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">
                Switch account on this device
              </p>
              <ul className="space-y-1.5">
                {accounts.map(a => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pickAccount(a.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-sm text-slate-200"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{a.displayName || a.email}</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-6 text-[11px] text-slate-500 leading-relaxed">
            <Lock className="w-3 h-3 inline -mt-0.5 mr-1" />
            Honest disclaimer: ShiftGuard accounts are stored on this browser only. Passwords are
            SHA-256 hashed with a per-account salt, but anyone with browser access can still read the
            encrypted index. Treat this device as your perimeter.
          </p>
        </div>
      </main>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta'

import { useEffect, useReducer } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, Lock, Server, Eye, KeyRound, ArrowRight, Trash2,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { isUnlocked, cacheSize, lock as secureLock } from '../lib/secureStore'
import {
  isLoggedIn, getActiveAccount, logout,
} from '../lib/accounts'
import { clearSessionRawKey } from '../lib/cryptoBox'

/**
 * /security — transparency page. Tells the user exactly what's encrypted, what
 * isn't, and what we can't protect against. Users should never have to guess
 * about our data handling.
 */
export default function Security() {
  const [, bump] = useReducer(n => n + 1, 0)

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('shiftguard-data-changed', on)
    window.addEventListener('shiftguard-secure-unlocked', on)
    return () => {
      window.removeEventListener('shiftguard-data-changed', on)
      window.removeEventListener('shiftguard-secure-unlocked', on)
    }
  }, [])

  const unlocked = isUnlocked()
  const account = getActiveAccount()
  const loggedIn = isLoggedIn()

  function lockNow() {
    clearSessionRawKey()
    secureLock()
    // Also log out so the UI doesn't look half-locked.
    logout()
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Security and privacy
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            How ShiftGuard protects your data
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mt-2">
            Plain-language summary of where your data lives, how it&rsquo;s encrypted, what
            we can defend against, and what we can&rsquo;t. No marketing.
          </p>
        </div>

        {/* Status card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">Current state</p>
              <p className="mt-1 text-white font-semibold">
                {loggedIn
                  ? `Signed in as ${account?.displayName || account?.email || 'account'}`
                  : 'Guest mode on this device'}
              </p>
              <p className="mt-0.5 text-sm text-slate-400">
                Vault is <strong className={unlocked ? 'text-green-300' : 'text-amber-300'}>{unlocked ? 'unlocked' : 'locked'}</strong>
                {' '}with <strong>{cacheSize()}</strong> decrypted records in memory for this tab.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={lockNow}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-100 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950/50 hover:bg-slate-800"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock vault and sign out
              </button>
              <Link
                to="/auth"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-950 bg-terracotta hover:bg-terracotta-dark px-3 py-2 rounded-lg"
              >
                Switch account
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Encryption detail */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            icon={<KeyRound className="w-4 h-4" />}
            title="At-rest encryption"
            body="Pay stubs, pay stub images, shifts, timesheets, violations, verification history, and documents are encrypted on disk with AES-GCM 256 before they touch localStorage."
          >
            <List items={[
              'Your password is run through PBKDF2-SHA256 (200,000 iterations) with a per-account 32-byte salt to derive the key.',
              'The key lives in the tab\u2019s sessionStorage only. Closing the tab erases it.',
              'We never upload your password, the derived key, or your encrypted data.',
              'Guest mode uses a random 32-byte device key stored locally. Still encrypted; upgrade to an account for passphrase protection.',
            ]} />
          </Card>

          <Card
            icon={<Server className="w-4 h-4" />}
            title="No server storing your data"
            body="We run no backend database. Your data never leaves your device except for one opt-in feature: document OCR, which sends the paystub image to Anthropic\u2019s Claude API only at the moment you upload."
          >
            <List items={[
              'Claude calls are gated to the moment you press "Parse" and receive no history or identifying metadata.',
              'When Claude is unavailable, the app uses on-device deterministic calculations instead.',
              'You can disable Claude entirely by leaving ANTHROPIC_API_KEY unset. The app still works; answers are derived locally.',
            ]} />
          </Card>

          <Card
            icon={<Lock className="w-4 h-4" />}
            title="What we protect against"
            body="Realistic threats we actively block:"
          >
            <List items={[
              'Shared machines: a co-worker on the same laptop can\u2019t read your paystubs without your password.',
              'Browser extensions that read storage but don\u2019t inject scripts.',
              'File-system forensics on a lost or stolen device.',
              'Cross-account leaks: each account has a separate scope; switching accounts re-bootstraps the cache with that account\u2019s key.',
            ]} />
          </Card>

          <Card
            icon={<Eye className="w-4 h-4" />}
            title="What we don\u2019t protect against"
            body="We are loud about this so you can choose."
          >
            <List items={[
              'A malicious script running inside ShiftGuard\u2019s origin. Defense is strict CSP and no untrusted innerHTML, not our crypto.',
              'A compromised device. Someone who can type your password has everything.',
              'Screenshots or clipboard snooping by other apps on your OS.',
              'Anthropic\u2019s handling of a document you explicitly sent them for OCR. Their policy applies; we don\u2019t resend.',
            ]} />
          </Card>
        </section>

        {/* Self-service actions */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold text-white mb-2">Self-service</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Link to="/vault" className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-terracotta/40">
              <p className="font-medium text-white inline-flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-terracotta" />
                Open your paystub vault
              </p>
              <p className="text-xs text-slate-400 mt-1">See every stub on file and delete any of them individually.</p>
            </Link>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('Delete every paystub, shift, timesheet, and setting on this device for the active account? This cannot be undone.')) return
                try {
                  for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i)
                    if (k && k.startsWith('account_')) localStorage.removeItem(k)
                  }
                  window.location.reload()
                } catch (err) {
                  console.error('[security] wipe failed', err)
                }
              }}
              className="text-left rounded-xl border border-slate-800 bg-slate-950/40 p-3 hover:border-red-500/40"
            >
              <p className="font-medium text-red-200 inline-flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                Wipe all data on this device
              </p>
              <p className="text-xs text-slate-400 mt-1">Clears every ShiftGuard key from localStorage for every account. Encrypted or not.</p>
            </button>
          </div>
        </section>

        <div className="mt-10">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

function Card({ icon, title, body, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center gap-2 text-terracotta">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-slate-300 leading-relaxed">{body}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

function List({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className="text-[12px] text-slate-400 leading-relaxed pl-3 relative">
          <span className="absolute left-0 top-1.5 w-1 h-1 rounded-full bg-terracotta/60" />
          {t}
        </li>
      ))}
    </ul>
  )
}

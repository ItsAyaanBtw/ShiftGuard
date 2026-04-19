import { createElement, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Shield, Clock, Camera, GitCompareArrows, FileText, BarChart3, CircleDollarSign,
  ShieldCheck, Wrench, Plug, Menu, X,
} from 'lucide-react'
import WorkflowProgress from './WorkflowProgress'
import ScrollProgress from './motion/ScrollProgress'

/**
 * Desktop shows the core workflow plus Tools / Dashboard / Pricing.
 * The hamburger (below lg) and overflow items (Vault, History) are available everywhere:
 *   - Vault is one tap away from Pay stub (header link inside /upload and /vault routes exist).
 *   - History is linked from the Dashboard insights strip.
 * This keeps the top bar readable at the 1024-1280px range where users cluster.
 */
const PRIMARY_NAV = [
  { path: '/log', label: 'Shifts', icon: Clock },
  { path: '/verify', label: 'Verify', icon: ShieldCheck },
  { path: '/upload', label: 'Pay stub', icon: Camera },
  { path: '/compare', label: 'Compare', icon: GitCompareArrows },
  { path: '/report', label: 'Report', icon: FileText },
  { path: '/tools', label: 'Tools', icon: Wrench },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/pricing', label: 'Pricing', icon: CircleDollarSign },
]

const MOBILE_NAV = [
  ...PRIMARY_NAV.slice(0, 5),
  { path: '/tools', label: 'Tools', icon: Wrench },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/pricing', label: 'Pricing', icon: CircleDollarSign },
]

export default function Header() {
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMobileOpen(false))
    return () => cancelAnimationFrame(id)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = e => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <header className="sticky top-0 z-[100] border-b border-slate-800/90 bg-slate-950/85 backdrop-blur-md">
      <ScrollProgress />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-2 shrink-0 min-h-[44px] min-w-[44px] py-2 -ml-2 pl-2 pr-3 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <Shield className="w-6 h-6 text-terracotta" aria-hidden />
            <span className="text-lg font-semibold text-white tracking-tight whitespace-nowrap">ShiftGuard</span>
          </Link>

          <nav
            className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 justify-end"
            aria-label="Main"
          >
            {PRIMARY_NAV.map(item => {
              const active = pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-lg text-[13px] xl:text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
                    active
                      ? 'bg-terracotta/15 text-terracotta'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {createElement(item.icon, { className: 'w-4 h-4 shrink-0', 'aria-hidden': true })}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <button
            type="button"
            className="lg:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-200 hover:bg-slate-800 border border-slate-700/80"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[120] bg-black/50 lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <nav
              id="mobile-nav"
              className="lg:hidden absolute left-0 right-0 top-full z-[130] border-b border-slate-800 bg-slate-950 shadow-lg max-h-[min(70vh,480px)] overflow-y-auto"
            >
              <ul className="py-2 px-2 space-y-0.5">
                {MOBILE_NAV.map(item => {
                  const active = pathname === item.path
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium min-h-[48px] ${
                          active ? 'bg-terracotta/15 text-terracotta' : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {createElement(item.icon, { className: 'w-5 h-5 shrink-0', 'aria-hidden': true })}
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </>
        )}

        <WorkflowProgress />
      </div>
    </header>
  )
}

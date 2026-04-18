import { Link, useLocation } from 'react-router-dom'
import { Shield, Clock, Camera, GitCompareArrows, FileText, BarChart3 } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/log', label: 'Shifts', icon: Clock },
  { path: '/upload', label: 'Upload', icon: Camera },
  { path: '/compare', label: 'Compare', icon: GitCompareArrows },
  { path: '/action', label: 'Action', icon: FileText },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
]

export default function Header() {
  const { pathname } = useLocation()

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Shield className="w-6 h-6 text-terracotta" />
            <span className="text-lg font-semibold text-white tracking-tight">ShiftGuard</span>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const active = pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                    active
                      ? 'bg-terracotta/15 text-terracotta'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}

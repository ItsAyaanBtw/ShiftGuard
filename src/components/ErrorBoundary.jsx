import { Component } from 'react'
import { Shield, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <Shield className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-slate-400 text-sm mb-6">
            An unexpected error occurred. Your data is safe in local storage.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-medium cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>
      </div>
    )
  }
}

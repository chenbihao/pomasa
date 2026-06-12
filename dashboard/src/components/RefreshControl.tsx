import { useState, useRef, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRefreshSettings } from '../stores/useRefreshSettings'
import { useTranslation } from 'react-i18next'

export default function RefreshControl() {
  const { enabled, interval, intervals, toggle, setInterval: setInterval_ } = useRefreshSettings()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const formatMs = (ms: number) => {
    if (ms >= 1000) return `${ms / 1000}s`
    return `${ms}ms`
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
          enabled
            ? 'text-blue-600 hover:bg-blue-50'
            : 'text-gray-400 hover:bg-gray-100'
        }`}
        title={enabled ? t('refresh.enabled') : t('refresh.disabled')}
      >
        <RefreshCw className={`w-4 h-4 ${enabled ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }} />
        <span className="text-xs font-medium">{formatMs(interval)}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border rounded-lg shadow-lg z-50 py-1">
          {/* Toggle */}
          <button
            onClick={() => { toggle() }}
            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between"
          >
            <span>{t('refresh.autoRefresh')}</span>
            <span className={`text-xs font-medium ${enabled ? 'text-green-600' : 'text-gray-400'}`}>
              {enabled ? t('refresh.on') : t('refresh.off')}
            </span>
          </button>

          <div className="border-t my-1" />

          {/* Interval options */}
          <div className="px-3 py-1.5 text-xs text-gray-400">{t('refresh.interval')}</div>
          {intervals.map(ms => (
            <button
              key={ms}
              onClick={() => { setInterval_(ms) }}
              className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between ${
                interval === ms ? 'text-blue-600 font-medium' : 'text-gray-700'
              }`}
            >
              <span>{formatMs(ms)}</span>
              {interval === ms && <span className="text-blue-500">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

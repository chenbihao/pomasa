import { useSyncExternalStore, useCallback } from 'react'

const STORAGE_KEY = 'pomasa-dashboard-refresh'

interface RefreshSettings {
  enabled: boolean
  interval: number
}

const INTERVALS = [3000, 5000, 10000, 30000] as const
const DEFAULT: RefreshSettings = { enabled: true, interval: 5000 }

// Module-level state
let settings: RefreshSettings = DEFAULT
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw)
    settings = {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT.enabled,
      interval: INTERVALS.includes(parsed.interval) ? parsed.interval : DEFAULT.interval,
    }
  }
} catch { /* localStorage unavailable or corrupt JSON */ }

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}

function getSnapshot() {
  return settings
}

function persist(next: Partial<RefreshSettings>) {
  settings = { ...settings, ...next }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
  for (const listener of listeners) {
    listener()
  }
}

export function useRefreshSettings() {
  const s = useSyncExternalStore(subscribe, getSnapshot)
  const toggle = useCallback(() => persist({ enabled: !settings.enabled }), [])
  const setInterval_ = useCallback((ms: number) => persist({ interval: ms }), [])
  return { ...s, toggle, setInterval: setInterval_, intervals: INTERVALS }
}

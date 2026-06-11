import { useSyncExternalStore, useCallback } from 'react'

const STORAGE_KEY = 'pomasa-dashboard-workdir'

// Module-level state — shared across all components
let workDir = ''
try {
  workDir = localStorage.getItem(STORAGE_KEY) ?? ''
} catch { /* localStorage unavailable */ }

const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}

function getSnapshot() {
  return workDir
}

function setWorkDir(dir: string) {
  workDir = dir
  try {
    localStorage.setItem(STORAGE_KEY, dir)
  } catch { /* localStorage unavailable */ }
  // Notify all subscribers
  for (const listener of listeners) {
    listener()
  }
}

export function useWorkDir() {
  const dir = useSyncExternalStore(subscribe, getSnapshot)
  const set = useCallback((d: string) => setWorkDir(d), [])
  return { workDir: dir, setWorkDir: set }
}

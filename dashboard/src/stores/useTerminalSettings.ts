import { useSyncExternalStore } from 'react'

interface TerminalSettings {
  fontSize: number
  themeId: string
  fontFamily: string
}

const STORAGE_KEY = 'pomasa-terminal-settings'

const defaults: TerminalSettings = {
  fontSize: 14,
  themeId: 'dark',
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
}

function load(): TerminalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaults
}

function save(settings: TerminalSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

let current = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot() {
  return current
}

function update(partial: Partial<TerminalSettings>) {
  current = { ...current, ...partial }
  save(current)
  listeners.forEach(l => l())
}

export function useTerminalSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot)
  return { settings, updateTerminalSettings: update }
}

export function getTerminalSettings(): TerminalSettings {
  return current
}

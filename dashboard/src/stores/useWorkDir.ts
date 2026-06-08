import { useState, useCallback } from 'react'

const STORAGE_KEY = 'pomasa-dashboard-workdir'

export function useWorkDir() {
  const [workDir, setWorkDirState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })

  const setWorkDir = useCallback((dir: string) => {
    setWorkDirState(dir)
    try {
      localStorage.setItem(STORAGE_KEY, dir)
    } catch { /* localStorage unavailable */ }
  }, [])

  return { workDir, setWorkDir }
}

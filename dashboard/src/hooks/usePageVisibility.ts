import { useState, useEffect } from 'react'

/**
 * Returns true when the current tab/page is visible.
 * Useful for pausing polling when the user is on another tab.
 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden)

  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  return visible
}

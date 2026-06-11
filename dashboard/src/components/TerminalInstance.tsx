import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { getTerminalTheme } from '../theme/terminalThemes'
import { useTerminalSettings } from '../stores/useTerminalSettings'
import { getTerminalWebSocketUrl } from '../api'
import '@xterm/xterm/css/xterm.css'

interface TerminalInstanceProps {
  workDir: string
  active: boolean
  onTitleChange?: (title: string) => void
  onActivity?: () => void
  searchQuery?: string
}

export default function TerminalInstance({
  workDir,
  active,
  onTitleChange,
  onActivity,
  searchQuery,
}: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const mountedRef = useRef(true)
  const [, setConnected] = useState(false)
  const { settings } = useTerminalSettings()

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (container.clientWidth === 0 || container.clientHeight === 0) return

    clearReconnectTimer()

    // Clean up previous
    wsRef.current?.close()
    wsRef.current = null
    termRef.current?.dispose()
    termRef.current = null
    fitAddonRef.current = null
    searchAddonRef.current = null
    container.innerHTML = ''

    const themeDef = getTerminalTheme(settings.themeId)

    const term = new Terminal({
      cursorBlink: true,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      theme: themeDef.theme,
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: true,
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon((_e, uri) => {
      window.open(uri, '_blank', 'noopener')
    })
    const unicode11Addon = new Unicode11Addon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)
    term.loadAddon(unicode11Addon)
    term.unicode.activeVersion = '11'

    // Try WebGL renderer, fallback to default canvas
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      term.loadAddon(webglAddon)
    } catch {
      // WebGL not available, use default renderer
    }

    term.open(container)
    termRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch { /* ignore */ }
    })

    // Track activity for background tab indicator
    term.onLineFeed(() => {
      if (!active && onActivity) onActivity()
    })

    // WebSocket
    const ws = new WebSocket(getTerminalWebSocketUrl())
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      reconnectAttemptRef.current = 0
      const dims = fitAddon.proposeDimensions()
      ws.send(JSON.stringify({
        type: 'start',
        cwd: workDir || '/',
        cols: dims?.cols ?? 80,
        rows: dims?.rows ?? 24,
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output') {
          term.write(msg.data)
        } else if (msg.type === 'exit') {
          term.writeln(`\r\n[Process exited with code ${msg.code}]`)
        } else if (msg.type === 'info') {
          if (!msg.pty) {
            term.writeln('\x1b[33m[Note] Running in basic mode. Interactive programs and resize are limited.\x1b[0m')
            term.writeln('')
          }
        } else if (msg.type === 'title') {
          onTitleChange?.(msg.title)
        }
      } catch {
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setConnected(false)
      term.writeln('\r\n\x1b[31m[Disconnected]\x1b[0m')
      scheduleReconnect()
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setConnected(false)
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })
  }, [workDir, settings.fontSize, settings.fontFamily, settings.themeId, active, onActivity, onTitleChange, clearReconnectTimer])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    const attempt = reconnectAttemptRef.current
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // 1s, 2s, 4s, ... max 30s
    reconnectAttemptRef.current = attempt + 1

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        connect()
      }
    }, delay)
  }, [connect])

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width === 0 || height === 0) return

      if (fitAddonRef.current && termRef.current) {
        try { fitAddonRef.current.fit() } catch { /* ignore */ }
      } else {
        connect()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [connect])

  // Re-apply theme when settings change (without reconnecting)
  useEffect(() => {
    if (!termRef.current) return
    const themeDef = getTerminalTheme(settings.themeId)
    termRef.current.options.theme = themeDef.theme
    termRef.current.options.fontSize = settings.fontSize
    termRef.current.options.fontFamily = settings.fontFamily
    try { fitAddonRef.current?.fit() } catch { /* ignore */ }
  }, [settings.themeId, settings.fontSize, settings.fontFamily])

  // Search
  useEffect(() => {
    if (!searchAddonRef.current || !searchQuery) return
    if (searchQuery) {
      searchAddonRef.current.findNext(searchQuery)
    }
  }, [searchQuery])

  // Keyboard shortcuts
  useEffect(() => {
    const term = termRef.current
    if (!term) return

    term.attachCustomKeyEventHandler((event) => {
      // Ctrl+Shift+C — copy
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault()
        const selection = term.getSelection()
        if (selection) {
          navigator.clipboard.writeText(selection)
        }
        return false
      }
      // Ctrl+Shift+V — paste
      if (event.ctrlKey && event.shiftKey && event.key === 'V') {
        event.preventDefault()
        navigator.clipboard.readText().then(text => {
          if (text && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: text }))
          }
        })
        return false
      }
      return true
    })
  }, [])

  // Cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearReconnectTimer()
      wsRef.current?.close()
      termRef.current?.dispose()
    }
  }, [clearReconnectTimer])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{ background: getTerminalTheme(settings.themeId).cssBackground }}
    />
  )
}

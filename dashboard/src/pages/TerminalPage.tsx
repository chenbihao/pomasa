import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import { getTerminalWebSocketUrl } from '../api'
import 'xterm/css/xterm.css'

interface TerminalPageProps {
  workDir: string
}

export default function TerminalPage({ workDir }: TerminalPageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [connected, setConnected] = useState(false)
  const { t } = useTranslation()

  const connect = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Abort if container has no visible dimensions yet (parent is hidden)
    if (container.clientWidth === 0 || container.clientHeight === 0) return

    wsRef.current?.close()
    wsRef.current = null
    termRef.current?.dispose()
    termRef.current = null
    fitAddonRef.current = null
    container.innerHTML = ''

    const fitAddon = new FitAddon()
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      }
    })

    term.loadAddon(fitAddon)
    term.open(container)
    termRef.current = term
    fitAddonRef.current = fitAddon

    // Fit after the terminal is in the DOM with real dimensions
    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch { /* ignore */ }
    })

    const ws = new WebSocket(getTerminalWebSocketUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'start', cwd: workDir || '/' }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output') term.write(msg.data)
        else if (msg.type === 'exit') term.writeln('\r\n[Process exited]')
      } catch { term.write(event.data) }
    }

    ws.onclose = () => {
      setConnected(false)
      term.writeln('\r\n[Disconnected]')
    }

    ws.onerror = () => {
      setConnected(false)
      term.writeln('\r\n[Connection error]')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }))
    })

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    })
  }, [workDir])

  // ResizeObserver: re-fit whenever the container changes size (including becoming visible)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width === 0 || height === 0) return

      // If terminal exists, just re-fit
      if (fitAddonRef.current && termRef.current) {
        try { fitAddonRef.current.fit() } catch { /* ignore */ }
      } else {
        // First time container has real dimensions — initialize terminal
        connect()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [connect])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      termRef.current?.dispose()
    }
  }, [])

  const headerActions = (
    <>
      <div className={`flex items-center gap-2 text-sm ${connected ? 'text-green-600' : 'text-red-600'}`}>
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        {connected ? t('terminal.connected') : t('terminal.disconnected')}
      </div>
      <Button variant="secondary" size="sm" onClick={connect}>
        <RefreshCw className={`w-3.5 h-3.5 ${connected ? '' : 'animate-spin'}`} />
        {t('terminal.reconnect')}
      </Button>
      <span className="text-sm text-gray-500">{workDir}</span>
    </>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader title={t('nav.terminal')} actions={headerActions} />
      <div ref={containerRef} className="flex-1 min-h-0 bg-[#1e1e1e]" />
    </div>
  )
}

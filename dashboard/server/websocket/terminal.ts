import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'

// Try to load node-pty for real PTY support; fallback to child_process.spawn
let ptyModule: typeof import('node-pty') | null = null
let ptyAvailable = false

try {
  ptyModule = await import('node-pty')
  ptyAvailable = true
} catch {
  console.warn('[terminal] node-pty not available, falling back to child_process.spawn')
  console.warn('[terminal] Interactive programs (vim, htop, etc.) and resize will not work')
}

interface ShellProcess {
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
  pid: number
}

function spawnWithPty(ws: WebSocket, cwd: string, cols: number, rows: number): ShellProcess {
  const isWin = process.platform === 'win32'
  const shell = isWin ? 'powershell.exe' : 'bash'
  const shellArgs = isWin ? [] : ['--login']

  const ptyProc = ptyModule!.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd,
    env: process.env as Record<string, string>,
  })

  ptyProc.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }))
    }
  })

  ptyProc.onExit(({ exitCode }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
    }
  })

  return {
    write: (data: string) => ptyProc.write(data),
    resize: (cols: number, rows: number) => ptyProc.resize(cols, rows),
    kill: () => ptyProc.kill(),
    pid: ptyProc.pid,
  }
}

function spawnWithChildProcess(ws: WebSocket, cwd: string): ShellProcess {
  const { spawn } = require('child_process') as typeof import('child_process')
  const isWin = process.platform === 'win32'
  const shell = isWin ? 'powershell.exe' : 'bash'
  const shellArgs = isWin ? [] : ['--login']

  const child = spawn(shell, shellArgs, {
    cwd,
    env: process.env as Record<string, string>,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  child.stdout?.on('data', (data: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data: data.toString() }))
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data: data.toString() }))
    }
  })

  child.on('error', (err: Error) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data: `\r\n[Error] ${err.message}\r\n` }))
      ws.send(JSON.stringify({ type: 'exit', code: 1 }))
    }
  })

  child.on('exit', (code: number | null) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: code ?? 0 }))
    }
  })

  return {
    write: (data: string) => child.stdin?.write(data),
    resize: (_cols: number, _rows: number) => {
      // No-op: child_process doesn't support resize
    },
    kill: () => child.kill(),
    pid: child.pid ?? -1,
  }
}

function spawnShell(ws: WebSocket, cwd: string, cols: number, rows: number): ShellProcess {
  if (ptyAvailable && ptyModule) {
    return spawnWithPty(ws, cwd, cols, rows)
  }
  return spawnWithChildProcess(ws, cwd)
}

export function setupTerminalWebSocket(server: Server, accessToken: string | null = null) {
  const wss = new WebSocketServer({ server, path: '/api/terminal' })

  wss.on('connection', (ws: WebSocket, req) => {
    // Verify access token from cookie
    if (accessToken) {
      const cookieHeader = req.headers.cookie || ''
      const cookies: Record<string, string> = {}
      for (const pair of cookieHeader.split(';')) {
        const [key, ...rest] = pair.split('=')
        if (key && rest.length) {
          cookies[key.trim()] = rest.join('=').trim()
        }
      }
      if (cookies.pomasa_access !== accessToken) {
        ws.close(4001, 'Unauthorized')
        return
      }
    }
    let shellProcess: ShellProcess | null = null

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString())

        if (msg.type === 'start') {
          const cwd = msg.cwd || process.cwd()
          const cols = msg.cols || 80
          const rows = msg.rows || 24
          shellProcess = spawnShell(ws, cwd, cols, rows)

          // Notify client whether PTY is available
          ws.send(JSON.stringify({
            type: 'info',
            pty: ptyAvailable,
            pid: shellProcess.pid,
          }))
        } else if (msg.type === 'input' && shellProcess) {
          shellProcess.write(msg.data)
        } else if (msg.type === 'resize' && shellProcess) {
          shellProcess.resize(msg.cols, msg.rows)
        } else if (msg.type === 'kill' && shellProcess) {
          shellProcess.kill()
        }
      } catch (err) {
        console.error('WebSocket error:', err)
      }
    })

    ws.on('close', () => {
      if (shellProcess) {
        shellProcess.kill()
        shellProcess = null
      }
    })
  })

  return wss
}

export { ptyAvailable }

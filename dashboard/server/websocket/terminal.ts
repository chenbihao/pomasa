import { WebSocketServer, WebSocket } from 'ws'
import { createRequire } from 'module'
import type { Server } from 'http'

const require = createRequire(import.meta.url)

function spawnPty(ws: WebSocket, cwd: string) {
  const pty = require('node-pty')

  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash'
  const shellArgs = process.platform === 'win32' ? [] : ['--login']

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd,
    env: process.env as Record<string, string>
  })

  ptyProcess.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }))
    }
  })

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
    }
  })

  return {
    write: (data: string) => {
      ptyProcess.write(data)
    },
    resize: (cols: number, rows: number) => {
      ptyProcess.resize(cols, rows)
    },
    kill: () => {
      ptyProcess.kill()
    }
  }
}

export function setupTerminalWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/api/terminal' })

  wss.on('connection', (ws: WebSocket) => {
    let ptyProcess: ReturnType<typeof spawnPty> | null = null

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString())

        if (msg.type === 'start') {
          const cwd = msg.cwd || process.cwd()
          ptyProcess = spawnPty(ws, cwd)
        } else if (msg.type === 'input' && ptyProcess) {
          ptyProcess.write(msg.data)
        } else if (msg.type === 'resize' && ptyProcess) {
          ptyProcess.resize(msg.cols, msg.rows)
        }
      } catch (err) {
        console.error('WebSocket error:', err)
      }
    })

    ws.on('close', () => {
      if (ptyProcess) {
        ptyProcess.kill()
        ptyProcess = null
      }
    })
  })

  return wss
}

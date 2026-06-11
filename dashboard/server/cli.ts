#!/usr/bin/env node

import os from 'os'
import { startServer } from './setup.js'

function getLanIp(): string | null {
  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address
      }
    }
  }
  return null
}

// Prevent crashes from taking down the process silently
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

// Parse --port argument
let port = 3001
const portArg = process.argv.indexOf('--port')
if (portArg !== -1 && process.argv[portArg + 1]) {
  port = parseInt(process.argv[portArg + 1], 10)
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10)
}

// Parse --host argument
let host = '0.0.0.0'
const hostArg = process.argv.indexOf('--host')
if (hostArg !== -1 && process.argv[hostArg + 1]) {
  host = process.argv[hostArg + 1]
} else if (process.env.HOST) {
  host = process.env.HOST
}

// Parse --no-token flag
const noToken = process.argv.includes('--no-token') || !!process.env.NO_TOKEN

// Start server, then open browser
startServer(port, host, { token: !noToken }).then(async ({ accessToken }) => {
  const lanIp = host === '0.0.0.0' ? getLanIp() : null
  const localUrl = `http://localhost:${port}`
  const openUrl = accessToken ? `${localUrl}/?token=${accessToken}` : localUrl

  console.log()
  console.log(`  POMASA Dashboard`)
  console.log(`  ─────────────────`)
  console.log(`  ➜  Local:   ${localUrl}${accessToken ? `/?token=${accessToken}` : ''}`)
  if (lanIp) {
    console.log(`  ➜  Network: http://${lanIp}:${port}${accessToken ? `/?token=${accessToken}` : ''}`)
  }
  if (accessToken) {
    console.log(`  ➜  Token:   ${accessToken}`)
  }
  console.log()

  try {
    const open = (await import('open')).default
    await open(openUrl)
  } catch {
    console.log(`  Open ${openUrl} in your browser`)
  }
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

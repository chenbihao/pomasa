#!/usr/bin/env node

import { startServer } from './setup.js'

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
  const displayHost = host === '0.0.0.0' ? 'localhost' : host
  const baseUrl = `http://${displayHost}:${port}`
  const url = accessToken ? `${baseUrl}/?token=${accessToken}` : baseUrl

  console.log(`POMASA Dashboard running at ${baseUrl}`)
  if (accessToken) {
    console.log(`Access token: ${accessToken}`)
    console.log(`Full URL (with token): ${url}`)
  }
  console.log(`API at ${baseUrl}/api`)
  console.log(`WebSocket terminal at ws://${displayHost}:${port}/api/terminal`)

  try {
    const open = (await import('open')).default
    await open(url)
    console.log(`Opened in browser`)
  } catch {
    console.log(`Please open ${url} in your browser`)
  }
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

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

// Start server, then open browser
startServer(port).then(async () => {
  const url = `http://localhost:${port}`
  try {
    const open = (await import('open')).default
    await open(url)
    console.log(`Opened ${url} in browser`)
  } catch {
    console.log(`Please open ${url} in your browser`)
  }
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

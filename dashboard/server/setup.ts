import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer, type Server } from 'http'
import { setupTerminalWebSocket } from './websocket/terminal.js'
import projectsRouter from './routes/projects.js'
import frameworkRouter from './routes/framework.js'
import filesystemRouter from './routes/filesystem.js'
import masRouter from './routes/mas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()
  const server = createServer(app)

  // Middleware
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // API Routes
  app.use('/api/projects', projectsRouter)
  app.use('/api/framework', frameworkRouter)
  app.use('/api/fs', filesystemRouter)
  app.use('/api/mas', masRouter)

  // WebSocket terminal
  setupTerminalWebSocket(server)

  // Static file serving (production mode)
  const distDir = path.resolve(__dirname, '../dist')
  app.use(express.static(distDir))

  // API 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // SPA fallback: all non-/api routes → index.html
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  return { app, server }
}

export function startServer(port: number, maxRetries = 10): Promise<Server> {
  const { server } = createApp()

  return new Promise((resolve, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && maxRetries > 0) {
        console.log(`Port ${port} in use, trying ${port + 1}...`)
        server.removeAllListeners('error')
        startServer(port + 1, maxRetries - 1).then(resolve).catch(reject)
      } else {
        reject(err)
      }
    })

    server.listen(port, () => {
      console.log(`POMASA Dashboard running at http://localhost:${port}`)
      console.log(`API at http://localhost:${port}/api`)
      console.log(`WebSocket terminal at ws://localhost:${port}/api/terminal`)
      resolve(server)
    })
  })
}

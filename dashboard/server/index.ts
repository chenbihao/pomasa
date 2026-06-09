import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { setupTerminalWebSocket } from './websocket/terminal.js'
import projectsRouter from './routes/projects.js'
import frameworkRouter from './routes/framework.js'
import filesystemRouter from './routes/filesystem.js'
import masRouter from './routes/mas.js'

const app = express()
const server = createServer(app)
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/projects', projectsRouter)
app.use('/api/framework', frameworkRouter)
app.use('/api/fs', filesystemRouter)
app.use('/api/mas', masRouter)

// WebSocket terminal
setupTerminalWebSocket(server)

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`WebSocket terminal at ws://localhost:${PORT}/api/terminal`)
})

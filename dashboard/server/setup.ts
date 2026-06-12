import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer, type Server } from 'http'
import { setupTerminalWebSocket } from './websocket/terminal.js'
import projectsRouter from './routes/projects.js'
import frameworkRouter from './routes/framework.js'
import filesystemRouter from './routes/filesystem.js'
import masRouter from './routes/mas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function generateToken(): string {
  return crypto.randomBytes(24).toString('hex')
}

function denyAccess(req: express.Request, res: express.Response) {
  const accept = req.headers.accept || ''
  if (accept.includes('text/html')) {
    res.status(401).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>POMASA Dashboard</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
  .box { text-align: center; padding: 2rem; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  h2 { color: #333; margin-bottom: 0.5rem; }
  p { color: #666; }
  code { background: #eee; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
</style></head>
<body><div class="box">
  <h2>🔒 需要访问令牌</h2>
  <p>请使用启动时输出的带有 <code>?token=...</code> 的 URL 访问</p>
</div></body></html>`)
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Access token required. Use ?token=... in URL.' })
  }
}

export function createApp(options: { token?: boolean } = {}) {
  const { token: enableToken = true } = options
  const app = express()
  const server = createServer(app)
  const accessToken = enableToken ? generateToken() : null

  // Middleware
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // Cookie parser (inline, no dependency)
  app.use((req, _res, next) => {
    if (!req.cookies) {
      req.cookies = {}
      const cookieHeader = req.headers.cookie
      if (cookieHeader) {
        for (const pair of cookieHeader.split(';')) {
          const [key, ...rest] = pair.split('=')
          if (key && rest.length) {
            req.cookies[key.trim()] = rest.join('=').trim()
          }
        }
      }
    }
    next()
  })

  // Token auth middleware
  if (accessToken) {
    app.use((req, res, next) => {
      // 1. Check query token
      const queryToken = req.query.token as string | undefined
      if (queryToken) {
        if (queryToken === accessToken) {
          // Valid token: set cookie and redirect to clean URL
          res.cookie('pomasa_access', accessToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
          })
          // Redirect to same path without query string
          const cleanUrl = req.path
          return res.redirect(302, cleanUrl)
        }
        // Invalid token in query → deny
        return denyAccess(req, res)
      }

      // 2. Check cookie
      const cookieToken = req.cookies?.pomasa_access
      if (cookieToken === accessToken) {
        return next()
      }

      // 3. No valid credential
      return denyAccess(req, res)
    })
  }

  // API Routes
  app.use('/api/projects', projectsRouter)
  app.use('/api/framework', frameworkRouter)
  app.use('/api/fs', filesystemRouter)
  app.use('/api/mas', masRouter)

  // WebSocket terminal
  setupTerminalWebSocket(server, accessToken)

  // Static file serving (production mode)
  const distDir = path.resolve(__dirname, '../dist')
  app.use(express.static(distDir))

  // API 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  // SPA fallback: all non-/api routes → index.html
  app.get('/{*splat}', (req, res, next) => {
    const indexPath = path.join(distDir, 'index.html')
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[SPA fallback] Failed to serve ${indexPath} for ${req.path}: ${err.message}`)
        next(err)
      }
    })
  })

  // Error handler
  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || 500
    res.status(status).json({ error: err.message || 'Internal Server Error' })
  })

  return { app, server, accessToken }
}

export function startServer(port: number, host = '0.0.0.0', options: { token?: boolean } = {}, maxRetries = 10): Promise<{ server: Server; accessToken: string | null }> {
  const { server, accessToken } = createApp(options)

  return new Promise((resolve, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && maxRetries > 0) {
        console.log(`Port ${port} in use, trying ${port + 1}...`)
        server.removeAllListeners('error')
        startServer(port + 1, host, options, maxRetries).then(resolve).catch(reject)
      } else {
        reject(err)
      }
    })

    server.listen(port, host, () => {
      resolve({ server, accessToken })
    })
  })
}

// Extend Express Request type for cookies
declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>
    }
  }
}

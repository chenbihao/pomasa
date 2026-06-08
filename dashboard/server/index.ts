import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs/promises'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { createRequire } from 'module'
import {
  assertPathInsideBase,
  assertSafeProjectName,
  assertSafeMasName,
  assertValidWorkdir,
} from './utils/paths.js'

const require = createRequire(import.meta.url)

const app = express()
const server = createServer(app)
const PORT = 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// WebSocket server for terminal
const wss = new WebSocketServer({ server, path: '/api/terminal' })

// ========== File System API ==========

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

async function buildFileTree(dirPath: string, maxDepth = 3, currentDepth = 0): Promise<FileNode[]> {
  if (currentDepth >= maxDepth) return []

  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  const sortedEntries = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of sortedEntries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const fullPath = path.join(dirPath, entry.name)
    const node: FileNode = {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? 'directory' : 'file'
    }

    if (entry.isDirectory()) {
      node.children = await buildFileTree(fullPath, maxDepth, currentDepth + 1)
    }

    nodes.push(node)
  }

  return nodes
}

// Get directory tree
app.get('/api/fs/tree', async (req, res) => {
  const dirPath = req.query.path as string
  const depth = parseInt(req.query.depth as string) || 3
  if (!dirPath) {
    return res.status(400).json({ error: 'Missing path parameter' })
  }

  try {
    const resolved = assertPathInsideBase(dirPath, dirPath)
    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' })
    }
    const tree = await buildFileTree(resolved, depth)
    res.json({ tree })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read directory'
    res.status(400).json({ error: message })
  }
})

// Read file content
app.get('/api/fs/file', async (req, res) => {
  const filePath = req.query.path as string
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' })
  }

  try {
    const resolved = assertPathInsideBase(filePath, filePath)
    const content = await fs.readFile(resolved, 'utf-8')
    res.json({ content })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read file'
    res.status(400).json({ error: message })
  }
})

// List subdirectories
app.get('/api/fs/dirs', async (req, res) => {
  const dirPath = req.query.path as string
  if (!dirPath) {
    return res.status(400).json({ error: 'Missing path parameter' })
  }

  try {
    const resolved = assertPathInsideBase(dirPath, dirPath)
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: path.join(resolved, e.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    res.json({ dirs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list directories'
    res.status(400).json({ error: message })
  }
})

// ========== Projects API ==========

interface ProjectInfo {
  name: string
  path: string
  hasObservation: boolean
  status: 'running' | 'completed' | 'failed' | 'pending' | 'unknown'
  progress: number
  stages: number
  stagesCompleted: number
  lastUpdate: string | null
  hasAlerts: boolean
  instance: string | null
}

interface RunManifest {
  instance: string
  created: string
  stages: {
    id: string
    agent: string
    depends_on: string[]
    fanout: string
  }[]
}

// Scan projects in work directory
app.get('/api/projects', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const validWorkdir = assertValidWorkdir(workdir)
    const entries = await fs.readdir(validWorkdir, { withFileTypes: true })
    const projects: ProjectInfo[] = []

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue

      const projectPath = path.join(validWorkdir, entry.name)
      const obsPath = path.join(projectPath, '_observation')

      try {
        await fs.access(obsPath)
        const project = await scanProject(entry.name, projectPath, obsPath)
        projects.push(project)
      } catch {
        projects.push({
          name: entry.name,
          path: projectPath,
          hasObservation: false,
          status: 'unknown',
          progress: 0,
          stages: 0,
          stagesCompleted: 0,
          lastUpdate: null,
          hasAlerts: false,
          instance: null
        })
      }
    }

    res.json({ projects })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to scan work directory'
    res.status(400).json({ error: message })
  }
})

async function scanProject(name: string, projectPath: string, obsPath: string): Promise<ProjectInfo> {
  let status: ProjectInfo['status'] = 'unknown'
  let progress = 0
  let stages = 0
  let stagesCompleted = 0
  let lastUpdate: string | null = null
  let hasAlerts = false
  let instance: string | null = null

  try {
    const obsEntries = await fs.readdir(obsPath, { withFileTypes: true })
    const instanceDir = obsEntries.find(e => e.isDirectory() && !e.name.startsWith('.'))

    if (instanceDir) {
      instance = instanceDir.name
      const instancePath = path.join(obsPath, instanceDir.name)

      // Read run_manifest.json
      try {
        const manifestContent = await fs.readFile(path.join(instancePath, 'run_manifest.json'), 'utf-8')
        const manifest: RunManifest = JSON.parse(manifestContent)
        stages = manifest.stages.length

        // Check each stage's assigned status
        const assignedDir = path.join(instancePath, '00.orchestrator', 'assigned')
        try {
          const assignedFiles = await fs.readdir(assignedDir)
          for (const stage of manifest.stages) {
            const statusFile = `${stage.id.replace(/^\d+\./, '')}.json`
            const matchFile = assignedFiles.find(f => f === statusFile || f === `${stage.id}.json`)
            if (matchFile) {
              try {
                const statusContent = await fs.readFile(path.join(assignedDir, matchFile), 'utf-8')
                const statusData = JSON.parse(statusContent)
                if (statusData.state === 'done' || statusData.state === 'completed') stagesCompleted++
                if (statusData.state === 'failed') status = 'failed'
                if (statusData.ts > (lastUpdate ?? '')) lastUpdate = statusData.ts
              } catch { /* ignore parse errors */ }
            }
          }
        } catch { /* no assigned directory yet */ }

        progress = stages > 0 ? stagesCompleted / stages : 0

        if (status !== 'failed') {
          if (stagesCompleted === stages && stages > 0) {
            status = 'completed'
          } else if (stagesCompleted > 0) {
            status = 'running'
          } else {
            status = 'pending'
          }
        }
      } catch { /* no manifest */ }

      // Check for alerts (WARN/ERROR in JSONL logs — parse line by line)
      try {
        const orchDir = path.join(instancePath, '00.orchestrator')
        const runLog = path.join(orchDir, 'run.jsonl')
        const content = await fs.readFile(runLog, 'utf-8')
        for (const line of content.split('\n')) {
          if (!line.trim()) continue
          try {
            const entry = JSON.parse(line)
            if (entry.level === 'WARN' || entry.level === 'ERROR') {
              hasAlerts = true
              break
            }
          } catch { /* skip malformed lines */ }
        }
      } catch { /* no log file */ }
    }
  } catch { /* error reading observation */ }

  return {
    name,
    path: projectPath,
    hasObservation: true,
    status,
    progress,
    stages,
    stagesCompleted,
    lastUpdate,
    hasAlerts,
    instance
  }
}

// Helper: find instance directory for a project
async function findInstanceDir(workdir: string, projectName: string) {
  const validWorkdir = assertValidWorkdir(workdir)
  const safeName = assertSafeProjectName(projectName)
  const projectPath = path.join(validWorkdir, safeName)
  const obsPath = path.join(projectPath, '_observation')
  const obsEntries = await fs.readdir(obsPath, { withFileTypes: true })
  const instanceDir = obsEntries.find(e => e.isDirectory() && !e.name.startsWith('.'))
  if (!instanceDir) return null
  return {
    projectPath,
    obsPath,
    instancePath: path.join(obsPath, instanceDir.name),
    instanceName: instanceDir.name,
  }
}

// Get project manifest
app.get('/api/projects/:name/manifest', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const info = await findInstanceDir(workdir, req.params.name)
    if (!info) return res.json({ instance: null, created: null, stages: [] })

    try {
      const manifestPath = path.join(info.instancePath, 'run_manifest.json')
      const content = await fs.readFile(manifestPath, 'utf-8')
      res.json(JSON.parse(content))
    } catch {
      // Instance directory exists but no manifest yet — project not started
      res.json({ instance: info.instanceName, created: null, stages: [] })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read manifest'
    res.status(400).json({ error: message })
  }
})

// Get project status (all agents)
app.get('/api/projects/:name/status', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const info = await findInstanceDir(workdir, req.params.name)
    if (!info) return res.status(404).json({ error: 'No instance found' })

    const agents: Record<string, { assigned: unknown; self: unknown }> = {}

    // Read assigned statuses
    const assignedDir = path.join(info.instancePath, '00.orchestrator', 'assigned')
    try {
      const assignedFiles = await fs.readdir(assignedDir)
      for (const file of assignedFiles) {
        if (!file.endsWith('.json')) continue
        const key = file.replace('.json', '')
        const content = await fs.readFile(path.join(assignedDir, file), 'utf-8')
        if (!agents[key]) agents[key] = { assigned: null, self: null }
        agents[key].assigned = JSON.parse(content)
      }
    } catch { /* no assigned directory */ }

    // Read self statuses
    const stageDirs = await fs.readdir(info.instancePath, { withFileTypes: true })
    for (const dir of stageDirs) {
      if (!dir.isDirectory() || dir.name.startsWith('.') || dir.name === '00.orchestrator' || dir.name === '_fallback') continue
      const statusFile = path.join(info.instancePath, dir.name, 'status.json')
      try {
        const content = await fs.readFile(statusFile, 'utf-8')
        if (!agents[dir.name]) agents[dir.name] = { assigned: null, self: null }
        agents[dir.name].self = JSON.parse(content)
      } catch { /* no status file */ }
    }

    res.json({ agents })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read status'
    res.status(400).json({ error: message })
  }
})

// Get project events (merged JSONL)
app.get('/api/projects/:name/events', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const info = await findInstanceDir(workdir, req.params.name)
    if (!info) return res.status(404).json({ error: 'No instance found' })

    const events: unknown[] = []

    // Read orchestrator run.jsonl
    const runLog = path.join(info.instancePath, '00.orchestrator', 'run.jsonl')
    try {
      const content = await fs.readFile(runLog, 'utf-8')
      for (const line of content.split('\n')) {
        if (line.trim()) {
          try { events.push(JSON.parse(line)) } catch { /* skip malformed lines */ }
        }
      }
    } catch { /* no run log */ }

    // Read agent _log.jsonl files
    const stageDirs = await fs.readdir(info.instancePath, { withFileTypes: true })
    for (const dir of stageDirs) {
      if (!dir.isDirectory() || dir.name.startsWith('.') || dir.name === '00.orchestrator') continue
      const logFile = path.join(info.instancePath, dir.name, '_log.jsonl')
      try {
        const content = await fs.readFile(logFile, 'utf-8')
        for (const line of content.split('\n')) {
          if (line.trim()) {
            try { events.push(JSON.parse(line)) } catch { /* skip malformed lines */ }
          }
        }
      } catch { /* no log file */ }
    }

    // Sort by timestamp ascending
    events.sort((a, b) => {
      const tsA = (a as Record<string, unknown>).ts as string || ''
      const tsB = (b as Record<string, unknown>).ts as string || ''
      return tsA.localeCompare(tsB)
    })

    res.json({ events })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read events'
    res.status(400).json({ error: message })
  }
})

// Get agent log (single agent's _log.jsonl)
app.get('/api/projects/:name/logs/:agentKey', async (req, res) => {
  const workdir = req.query.workdir as string
  const agentKey = req.params.agentKey

  try {
    const info = await findInstanceDir(workdir, req.params.name)
    if (!info) return res.status(404).json({ error: 'No instance found' })

    const logFile = path.join(info.instancePath, agentKey, '_log.jsonl')

    try {
      const content = await fs.readFile(logFile, 'utf-8')
      const lines = content.split('\n').filter(l => l.trim())
      const logs = lines.map(l => {
        try { return JSON.parse(l) } catch { return null }
      }).filter(Boolean)
      res.json({ logs })
    } catch {
      res.json({ logs: [] })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read agent log'
    res.status(400).json({ error: message })
  }
})

// ========== Framework API ==========

// Get patterns list from POMASA skill
app.get('/api/framework/patterns', async (_req, res) => {
  const skillsPath = path.resolve(process.cwd(), '../skills/pomasa/pattern-catalog')

  try {
    const entries = await fs.readdir(skillsPath, { withFileTypes: true })
    const patterns = []

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md') continue

      const match = entry.name.match(/^(COR|STR|BHV|QUA)-(\d+)-(.+)\.md$/)
      if (!match) continue

      const [, prefix, num, nameSlug] = match
      const filePath = path.join(skillsPath, entry.name)
      const content = await fs.readFile(filePath, 'utf-8')

      let necessity = 'Optional'
      if (content.includes('**Necessity**: Required')) necessity = 'Required'
      else if (content.includes('**Necessity**: Recommended')) necessity = 'Recommended'

      const problemMatch = content.match(/## Problem\s*\n\n(.+?)(?:\n\n|\n##)/s)
      const description = problemMatch ? problemMatch[1].replace(/\n/g, ' ').trim().slice(0, 100) : ''

      patterns.push({
        id: `${prefix}-${num.padStart(2, '0')}`,
        name: nameSlug.replace(/-/g, ' '),
        category: prefix,
        necessity,
        description
      })
    }

    res.json({ patterns })
  } catch (err) {
    console.error('Failed to load patterns:', err)
    res.json({ patterns: [] })
  }
})

// Get generator prompt
app.get('/api/framework/generator', async (_req, res) => {
  const generatorPath = path.resolve(process.cwd(), '../skills/pomasa/SKILL.md')
  try {
    const content = await fs.readFile(generatorPath, 'utf-8')
    res.json({ content })
  } catch {
    res.status(404).json({ error: 'Generator not found' })
  }
})

// Get user input template
app.get('/api/framework/template', async (_req, res) => {
  const templatePath = path.resolve(process.cwd(), '../skills/pomasa/user_input_template.md')
  const templatePathZh = path.resolve(process.cwd(), '../skills/pomasa/user_input_template_zh.md')
  try {
    let content
    try {
      content = await fs.readFile(templatePath, 'utf-8')
    } catch {
      content = await fs.readFile(templatePathZh, 'utf-8')
    }
    res.json({ content })
  } catch {
    res.status(404).json({ error: 'Template not found' })
  }
})

// ========== MAS Creation API ==========

interface CreateMasRequest {
  targetDir: string
  masName: string
  userInput: Record<string, unknown>
  selectedPatterns: string[]
  /** UI language — 'zh' or 'en', used to pick the template */
  language?: string
}

function sendSse(res: express.Response, data: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

app.post('/api/mas/create', async (req, res) => {
  const { targetDir, masName, userInput, selectedPatterns, language } = req.body as CreateMasRequest

  // Set response headers for streaming
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    if (!targetDir || !masName) {
      sendSse(res, { type: 'error', content: 'Missing targetDir or masName' })
      sendSse(res, { type: 'done', code: 1 })
      return res.end()
    }

    assertSafeMasName(masName)
    assertPathInsideBase(targetDir, targetDir)

    const masPath = path.join(targetDir, masName)

    // Check if directory already exists
    try {
      await fs.access(masPath)
      sendSse(res, { type: 'error', content: 'Directory already exists' })
      sendSse(res, { type: 'done', code: 1 })
      return res.end()
    } catch {
      // Directory doesn't exist, good to proceed
    }

    // Create the directory
    await fs.mkdir(masPath, { recursive: true })

    // Read the template — pick Chinese or English based on UI language
    const templateFile = language === 'zh' ? 'user_input_template_zh.md' : 'user_input_template.md'
    const templatePath = path.resolve(process.cwd(), 'templates', templateFile)
    let template = await fs.readFile(templatePath, 'utf-8')

    const ui = userInput

    // Build checkbox blocks — use Chinese labels when language is 'zh'
    const isZhLang = language === 'zh'
    const formats = (ui.deliverableFormats as string) || 'Markdown'
    const deliverableBlock = isZhLang ? [
      `- [x] Markdown（始终生成）`,
      `- [${formats.includes('pdf') ? 'x' : ' '}] PDF（推荐，便于分发）`,
      `- [${formats.includes('docx') ? 'x' : ' '}] DOCX（推荐，便于编辑）`,
      `- [${formats.includes('wiki') ? 'x' : ' '}] Wiki（持久化的 Obsidian 知识图谱，用于跨次运行的研究积累）`,
    ].join('\n') : [
      `- [x] Markdown (always generated)`,
      `- [${formats.includes('pdf') ? 'x' : ' '}] PDF (recommended, for distribution)`,
      `- [${formats.includes('docx') ? 'x' : ' '}] DOCX (recommended, for editing)`,
      `- [${formats.includes('wiki') ? 'x' : ' '}] Wiki (persistent Obsidian knowledge graph, for compounding research across runs)`,
    ].join('\n')

    const ql = ui.qualityLevel as string || 'standard'
    const qualityBlock = isZhLang ? [
      `- [${ql === 'simple' ? 'x' : ' '}] 简单（Simple）：仅采用必需的模式，不进行额外的质量检查`,
      `- [${ql === 'standard' ? 'x' : ' '}] 标准（Standard，默认）：采用 QUA-01 嵌入式质量标准 + BHV-05 基于事实的网络研究`,
      `- [${ql === 'strict' ? 'x' : ' '}] 严格（Strict）：采用 QUA-01 + QUA-02 多层质量保证 + BHV-05 基于事实的网络研究`,
    ].join('\n') : [
      `- [${ql === 'simple' ? 'x' : ' '}] Simple: Only adopt required patterns, no additional quality checks`,
      `- [${ql === 'standard' ? 'x' : ' '}] Standard (default): Adopt QUA-01 Embedded Quality Standards + BHV-05 Grounded Web Research`,
      `- [${ql === 'strict' ? 'x' : ' '}] Strict: Adopt QUA-01 + QUA-02 Multi-Layer Quality Assurance + BHV-05 Grounded Web Research`,
    ].join('\n')

    const ol = ui.observabilityLevel as string || 'normal'
    const obsBlock = isZhLang ? [
      `- [${ol === 'none' ? 'x' : ' '}] none：不产生执行日志（节省 token）；编排者仍仅记录验收判定`,
      `- [${ol === 'minimal' ? 'x' : ' '}] minimal：只记录错误（ERROR）`,
      `- [${ol === 'normal' ? 'x' : ' '}] normal（默认）：记录错误 + 警告（含 agent 的降级、缩范围、困难）`,
      `- [${ol === 'detailed' ? 'x' : ' '}] detailed：记录全部（含全链路 INFO 里程碑）`,
    ].join('\n') : [
      `- [${ol === 'none' ? 'x' : ' '}] none: No execution logs (saves tokens); the orchestrator still records acceptance verdicts only`,
      `- [${ol === 'minimal' ? 'x' : ' '}] minimal: Log errors only`,
      `- [${ol === 'normal' ? 'x' : ' '}] normal (default): Log errors + warnings (including agent degradations, scope reductions, and difficulties)`,
      `- [${ol === 'detailed' ? 'x' : ' '}] detailed: Log everything (including INFO milestones across the full chain)`,
    ].join('\n')

    // Build reference list
    const refLines = ((ui.existingReferences as string) || '').split('\n').filter(l => l.trim())
    const refBlock = refLines.length > 0
      ? refLines.map(l => `- ${l.trim()}`).join('\n')
      : '- None'

    // Simple placeholder replacement
    const replacements: Record<string, string> = {
      '{{BLUEPRINT_LANGUAGE}}': ui.blueprintLanguage as string || 'Chinese',
      '{{REPORT_LANGUAGE}}': ui.reportLanguage as string || 'Chinese',
      '{{PROJECT_IDENTIFIER}}': ui.projectIdentifier as string || masName,
      '{{RESEARCH_TOPIC}}': ui.researchTopic as string || '',
      '{{INITIAL_IDEAS}}': ui.initialIdeas as string || '',
      '{{DATA_SOURCES}}': ui.dataSources as string || '',
      '{{EXISTING_REFERENCES}}': refBlock,
      '{{ANALYSIS_METHODS}}': ui.analysisMethods as string || '',
      '{{REPORT_FORMAT}}': ui.reportFormat as string || '',
      '{{REPORT_STRUCTURE}}': ui.reportStructure as string || '',
      '{{DELIVERABLE_FORMATS}}': deliverableBlock,
      '{{QUALITY_LEVEL}}': qualityBlock,
      '{{OBSERVABILITY_LEVEL}}': obsBlock,
      '{{PATTERN_OVERRIDES}}': ui.patternOverrides as string || 'None',
      '{{OTHER_REQUIREMENTS}}': ui.otherRequirements as string || 'None',
      '{{SELECTED_PATTERNS}}': selectedPatterns.join(', '),
    }

    for (const [placeholder, value] of Object.entries(replacements)) {
      template = template.replaceAll(placeholder, value)
    }

    await fs.writeFile(path.join(masPath, 'user_input_template.md'), template)
    sendSse(res, { type: 'output', content: 'Created user_input_template.md\n' })

    // Create the basic structure
    const dirs = ['agents', 'references', 'workspace', '_observation']
    for (const dir of dirs) {
      await fs.mkdir(path.join(masPath, dir), { recursive: true })
      sendSse(res, { type: 'output', content: `Created directory: ${dir}/\n` })
    }

    sendSse(res, { type: 'output', content: '\n--- Completed ---\n' })
    sendSse(res, { type: 'done', code: 0, masPath })
    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during creation'
    sendSse(res, { type: 'error', content: message })
    sendSse(res, { type: 'done', code: 1 })
    res.end()
  }
})

// ========== WebSocket Terminal ==========

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

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`WebSocket terminal at ws://localhost:${PORT}/api/terminal`)
})

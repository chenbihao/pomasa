import { Router } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { assertValidWorkdir, assertSafeProjectName } from '../utils/paths.js'
import { scanProject, detectPrepStages, findInstanceDir } from '../services/projectScanner.js'
import { buildFileTree } from './filesystem.js'

const router = Router()

// Scan projects in work directory
router.get('/', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const validWorkdir = assertValidWorkdir(workdir)
    const entries = await fs.readdir(validWorkdir, { withFileTypes: true })
    const projects = []

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue

      const projectPath = path.join(validWorkdir, entry.name)
      const obsPath = path.join(projectPath, '_observation')

      // Always scan — prep stages exist before _observation does
      const project = await scanProject(entry.name, projectPath, obsPath)
      projects.push(project)
    }

    res.json({ projects })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to scan work directory'
    res.status(400).json({ error: message })
  }
})

// Get project manifest (including preparation stages)
router.get('/:name/manifest', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const validWorkdir = assertValidWorkdir(workdir)
    const safeName = assertSafeProjectName(req.params.name)
    const projectPath = path.join(validWorkdir, safeName)

    // Always detect prep stages
    const prepStages = await detectPrepStages(projectPath)

    // Try to find instance dir (may not exist yet during prep phase)
    try {
      const info = await findInstanceDir(workdir, req.params.name)
      if (!info) {
        return res.json({ instance: null, created: null, stages: [], prepStages })
      }

      try {
        const manifestPath = path.join(info.instancePath, 'run_manifest.json')
        const content = await fs.readFile(manifestPath, 'utf-8')
        const manifest = JSON.parse(content)
        manifest.prepStages = prepStages
        res.json(manifest)
      } catch {
        res.json({ instance: info.instanceName, created: null, stages: [], prepStages })
      }
    } catch {
      // No _observation directory — still return prep stages
      res.json({ instance: null, created: null, stages: [], prepStages })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read manifest'
    res.status(400).json({ error: message })
  }
})

// Get project status (all agents)
router.get('/:name/status', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    assertSafeProjectName(req.params.name)
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
router.get('/:name/events', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    assertSafeProjectName(req.params.name)
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
router.get('/:name/logs/:agentKey', async (req, res) => {
  const workdir = req.query.workdir as string
  const agentKey = req.params.agentKey

  try {
    assertSafeProjectName(req.params.name)
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

// Get agent blueprints (agents/*.md files)
router.get('/:name/agents', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const validWorkdir = assertValidWorkdir(workdir)
    const safeName = assertSafeProjectName(req.params.name)
    const agentsDir = path.join(validWorkdir, safeName, 'agents')

    const entries = await fs.readdir(agentsDir)
    const mdFiles = entries.filter(f => f.endsWith('.md')).sort()

    const agents = await Promise.all(
      mdFiles.map(async (fileName) => {
        const filePath = path.join(agentsDir, fileName)
        const content = await fs.readFile(filePath, 'utf-8')
        const name = fileName.replace('.md', '')
        return { name, fileName, path: filePath, content }
      })
    )

    res.json({ agents })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read agent blueprints'
    res.status(400).json({ error: message })
  }
})

// Get project file tree for a section (references, workspace, wip)
router.get('/:name/files/:section', async (req, res) => {
  const workdir = req.query.workdir as string
  const section = req.params.section

  const allowedSections = ['references', 'workspace', 'wip', 'agents', 'scripts', 'library', 'wiki', '_output']
  if (!allowedSections.includes(section)) {
    return res.status(400).json({ error: `Invalid section. Allowed: ${allowedSections.join(', ')}` })
  }

  try {
    const validWorkdir = assertValidWorkdir(workdir)
    const safeName = assertSafeProjectName(req.params.name)
    const sectionPath = path.join(validWorkdir, safeName, section)

    try {
      const stat = await fs.stat(sectionPath)
      if (!stat.isDirectory()) {
        return res.json({ tree: [] })
      }
    } catch {
      return res.json({ tree: [] })
    }

    const tree = await buildFileTree(sectionPath, 5)
    res.json({ tree })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read project files'
    res.status(400).json({ error: message })
  }
})

// Get project config files (config.yml, README.md, user_input_template.md)
router.get('/:name/config', async (req, res) => {
  const workdir = req.query.workdir as string

  try {
    const validWorkdir = assertValidWorkdir(workdir)
    const safeName = assertSafeProjectName(req.params.name)
    const projectPath = path.join(validWorkdir, safeName)

    const readFile = async (fileName: string): Promise<string | null> => {
      try {
        return await fs.readFile(path.join(projectPath, fileName), 'utf-8')
      } catch {
        return null
      }
    }

    const [config, readme, template] = await Promise.all([
      readFile('config.yml'),
      readFile('README.md'),
      readFile('user_input_template.md'),
    ])

    res.json({ config, readme, template })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read project config'
    res.status(400).json({ error: message })
  }
})

export default router

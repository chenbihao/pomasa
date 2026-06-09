import { Router } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { assertPathInsideBase } from '../utils/paths.js'

const router = Router()

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export async function buildFileTree(dirPath: string, maxDepth = 3, currentDepth = 0): Promise<FileNode[]> {
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
router.get('/tree', async (req, res) => {
  const dirPath = req.query.path as string
  const depth = Math.min(Math.max(parseInt(req.query.depth as string) || 3, 1), 10)
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
router.get('/file', async (req, res) => {
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

// Get directory modification fingerprint (for change detection)
router.get('/changes', async (req, res) => {
  const dirPath = req.query.path as string
  if (!dirPath) {
    return res.status(400).json({ error: 'Missing path parameter' })
  }

  try {
    const resolved = assertPathInsideBase(dirPath, dirPath)
    const entries = await fs.readdir(resolved, { withFileTypes: true })
    // Build a lightweight fingerprint: name + mtime for each entry
    const fingerprints: Record<string, number> = {}
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      try {
        const stat = await fs.stat(path.join(resolved, entry.name))
        fingerprints[entry.name] = stat.mtimeMs
      } catch { /* skip */ }
    }
    res.json({ fingerprints })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to check changes'
    res.status(400).json({ error: message })
  }
})

// Get file stat (mtime, size)
router.get('/stat', async (req, res) => {
  const filePath = req.query.path as string
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' })
  }

  try {
    const resolved = assertPathInsideBase(filePath, filePath)
    const stat = await fs.stat(resolved)
    res.json({ mtimeMs: stat.mtimeMs, size: stat.size })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to stat file'
    res.status(400).json({ error: message })
  }
})

// List subdirectories
router.get('/dirs', async (req, res) => {
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

export default router

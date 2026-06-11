import { Router } from 'express'
import path from 'path'
import fs from 'fs/promises'

const router = Router()

/**
 * Search for skills/pomasa/ directory starting from cwd and going up.
 * Returns the resolved path or null if not found.
 */
async function findSkillsDir(): Promise<string | null> {
  let dir = process.cwd()
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, 'skills', 'pomasa')
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Not found at this level, try parent
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

// Get patterns list from POMASA skill
router.get('/patterns', async (_req, res) => {
  const skillsDir = await findSkillsDir()
  if (!skillsDir) {
    return res.json({ patterns: [] })
  }

  const skillsPath = path.join(skillsDir, 'pattern-catalog')

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
router.get('/generator', async (_req, res) => {
  const skillsDir = await findSkillsDir()
  if (!skillsDir) {
    return res.status(404).json({ error: 'POMASA skills not found. Run this command from within a POMASA project directory.' })
  }

  const generatorPath = path.join(skillsDir, 'SKILL.md')
  try {
    const content = await fs.readFile(generatorPath, 'utf-8')
    res.json({ content })
  } catch {
    res.status(404).json({ error: 'Generator not found' })
  }
})

// Get user input template
router.get('/template', async (_req, res) => {
  const skillsDir = await findSkillsDir()
  if (!skillsDir) {
    return res.status(404).json({ error: 'POMASA skills not found. Run this command from within a POMASA project directory.' })
  }

  const templatePath = path.join(skillsDir, 'user_input_template.md')
  const templatePathZh = path.join(skillsDir, 'user_input_template_zh.md')
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

export default router

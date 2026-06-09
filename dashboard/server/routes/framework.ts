import { Router } from 'express'
import path from 'path'
import fs from 'fs/promises'

const router = Router()

// Get patterns list from POMASA skill
router.get('/patterns', async (_req, res) => {
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
router.get('/generator', async (_req, res) => {
  const generatorPath = path.resolve(process.cwd(), '../skills/pomasa/SKILL.md')
  try {
    const content = await fs.readFile(generatorPath, 'utf-8')
    res.json({ content })
  } catch {
    res.status(404).json({ error: 'Generator not found' })
  }
})

// Get user input template
router.get('/template', async (_req, res) => {
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

export default router

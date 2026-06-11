import { Router } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { assertPathInsideBase, assertSafeMasName } from '../utils/paths.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const router = Router()

interface CreateMasRequest {
  targetDir: string
  masName: string
  userInput: Record<string, unknown>
  selectedPatterns: string[]
  /** UI language — 'zh' or 'en', used to pick the template */
  language?: string
}

function sendSse(res: import('express').Response, data: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

router.post('/create', async (req, res) => {
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
    const templatePath = path.resolve(__dirname, '../../templates', templateFile)
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

export default router

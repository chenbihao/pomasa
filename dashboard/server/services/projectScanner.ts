import path from 'path'
import fs from 'fs/promises'

export interface ProjectInfo {
  name: string
  path: string
  hasObservation: boolean
  status: 'running' | 'completed' | 'failed' | 'pending' | 'unknown' | 'preparing' | 'ready'
  progress: number
  stages: number
  stagesCompleted: number
  lastUpdate: string | null
  hasAlerts: boolean
  instance: string | null
  prepDetail?: string
}

export interface RunManifest {
  instance: string
  created: string
  stages: {
    id: string
    agent: string
    depends_on: string[]
    fanout: string
  }[]
}

export interface PrepStage {
  id: string
  label: string
  state: 'done' | 'running' | 'pending'
  ts: string | null
  detail?: string
}

/** Count expected agent blueprints by parsing orchestrator's --stages line */
export async function countExpectedAgents(projectPath: string): Promise<number> {
  try {
    const orchPath = path.join(projectPath, 'agents', '00.orchestrator.md')
    const content = await fs.readFile(orchPath, 'utf-8')
    // Look for: --stages '01.collection:01.source_collector,02.analysis:02.analyzer,...'
    const match = content.match(/--stages\s+'([^']+)'/)
    if (match) {
      return match[1].split(',').filter(s => s.trim()).length
    }
  } catch { /* orchestrator not readable */ }
  return 0
}

/** Count existing agent blueprint files (excluding orchestrator) */
export async function countAgentFiles(projectPath: string): Promise<number> {
  try {
    const agentsDir = path.join(projectPath, 'agents')
    const entries = await fs.readdir(agentsDir)
    return entries.filter(f => f.endsWith('.md') && f !== '00.orchestrator.md').length
  } catch { /* no agents dir */ }
  return 0
}

/** Detect preparation stage completion by checking key files */
export async function detectPrepStages(projectPath: string): Promise<PrepStage[]> {
  // 0.1 创建模板
  let s01done = false, s01ts: string | null = null
  try {
    const stat = await fs.stat(path.join(projectPath, 'user_input_template.md'))
    s01done = true
    s01ts = stat.mtime.toISOString()
  } catch { /* not found */ }

  // 0.2 & 0.3 创建蓝图 (merged: show progress n/m)
  let blueprintState: 'done' | 'running' | 'pending' = 'pending'
  let blueprintTs: string | null = null
  let blueprintDetail: string | undefined
  let orchExists = false
  try {
    const stat = await fs.stat(path.join(projectPath, 'agents', '00.orchestrator.md'))
    orchExists = true
    blueprintTs = stat.mtime.toISOString()
    const [actual, expected] = await Promise.all([
      countAgentFiles(projectPath),
      countExpectedAgents(projectPath),
    ])
    if (expected > 0) {
      blueprintDetail = `${actual}/${expected}`
      blueprintState = actual >= expected ? 'done' : 'running'
    } else {
      // Can't determine expected count; treat any agents as running
      blueprintState = actual > 0 ? 'running' : 'pending'
      if (actual > 0) blueprintDetail = `${actual}`
    }
  } catch { /* orchestrator not found */ }

  // 0.4 结构创建完成
  let s04done = false, s04ts: string | null = null
  try {
    const stat = await fs.stat(path.join(projectPath, 'README.md'))
    s04done = true
    s04ts = stat.mtime.toISOString()
  } catch { /* not found */ }

  return [
    { id: '0.1', label: '创建模板', state: s01done ? 'done' as const : 'pending' as const, ts: s01ts },
    {
      id: '0.2',
      label: blueprintState === 'done' ? '创建蓝图完成' : '创建蓝图',
      state: (blueprintState === 'done' ? 'done' : orchExists ? 'running' : 'pending') as 'done' | 'pending' | 'running',
      ts: blueprintTs,
      detail: blueprintDetail,
    },
    { id: '0.3', label: '结构创建完成', state: s04done ? 'done' as const : 'pending' as const, ts: s04ts },
  ]
}

/** Scan a single project and return its info */
export async function scanProject(name: string, projectPath: string, obsPath: string): Promise<ProjectInfo> {
  let status: ProjectInfo['status'] = 'unknown'
  let orchStages = 0
  let orchCompleted = 0
  let lastUpdate: string | null = null
  let hasAlerts = false
  let instance: string | null = null
  let prepDetail: string | undefined
  let hasObservation = false

  // ===== Phase 1: Detect Orchestrator's internal prep steps =====
  const PREP_STEPS = 3
  let prepDone = 0

  // 0.1 创建模板
  try { await fs.access(path.join(projectPath, 'user_input_template.md')); prepDone++ } catch {}

  // 0.2 创建蓝图 (progressive n/m)
  let blueprintComplete = false
  try {
    await fs.access(path.join(projectPath, 'agents', '00.orchestrator.md'))
    const [actual, expected] = await Promise.all([
      countAgentFiles(projectPath),
      countExpectedAgents(projectPath),
    ])
    if (expected > 0) {
      prepDetail = `${actual}/${expected}`
      blueprintComplete = actual >= expected
    } else {
      blueprintComplete = actual > 0
      if (actual > 0) prepDetail = `${actual}`
    }
  } catch {}
  if (blueprintComplete) prepDone++

  // 0.3 结构创建完成
  try { await fs.access(path.join(projectPath, 'README.md')); prepDone++ } catch {}

  const prepAllDone = prepDone >= PREP_STEPS

  // ===== Phase 2: Scan manifest stages (only if _observation exists) =====
  try {
    await fs.access(obsPath)
    hasObservation = true

    const obsEntries = await fs.readdir(obsPath, { withFileTypes: true })
    const instanceDir = obsEntries.find(e => e.isDirectory() && !e.name.startsWith('.'))

    if (instanceDir) {
      instance = instanceDir.name
      const instancePath = path.join(obsPath, instanceDir.name)

      try {
        const manifestContent = await fs.readFile(path.join(instancePath, 'run_manifest.json'), 'utf-8')
        const manifest: RunManifest = JSON.parse(manifestContent)
        orchStages = manifest.stages.length

        const assignedDir = path.join(instancePath, '00.orchestrator', 'assigned')
        try {
          const assignedFiles = await fs.readdir(assignedDir)
          for (const stage of manifest.stages) {
            const statusFile = `${stage.id.replace(/^\d+\./, '')}.json`
            const matchFile = assignedFiles.find(f => f === statusFile || f === `${stage.id}.json`)
            if (matchFile) {
              try {
                const sc = await fs.readFile(path.join(assignedDir, matchFile), 'utf-8')
                const sd = JSON.parse(sc)
                if (sd.state === 'done' || sd.state === 'completed') orchCompleted++
                if (sd.state === 'failed') status = 'failed'
                if (sd.ts > (lastUpdate ?? '')) lastUpdate = sd.ts
              } catch {}
            }
          }
        } catch {}

        try {
          const runLog = path.join(instancePath, '00.orchestrator', 'run.jsonl')
          const content = await fs.readFile(runLog, 'utf-8')
          for (const line of content.split('\n')) {
            if (!line.trim()) continue
            try {
              const entry = JSON.parse(line)
              if (entry.level === 'WARN' || entry.level === 'ERROR') { hasAlerts = true; break }
            } catch {}
          }
        } catch {}
      } catch {}
    }
  } catch {}

  // ===== Phase 3: Determine status =====
  // Status flow based on QUA-04:
  //   pending    → user_input_template.md doesn't exist (project created, waiting for requirements)
  //   preparing  → user_input_template.md exists, but blueprints not complete
  //   ready      → all blueprints complete, waiting for orchestrator to start
  //   running    → run_manifest.json exists (orchestrator called manager.sh init)
  //   completed  → all stages done
  //   failed     → any stage failed

  // Check if run_manifest.json exists (orchestrator has started)
  let manifestExists = false
  try {
    const obsEntries = await fs.readdir(obsPath, { withFileTypes: true })
    const instanceDir = obsEntries.find(e => e.isDirectory() && !e.name.startsWith('.'))
    if (instanceDir) {
      await fs.access(path.join(obsPath, instanceDir.name, 'run_manifest.json'))
      manifestExists = true
    }
  } catch {}

  const totalStages = manifestExists ? 1 + orchStages : 1
  const completedStages = manifestExists ? 1 + orchCompleted : 0
  const progress = totalStages > 0 ? completedStages / totalStages : 0

  if (status === 'failed') {
    // Keep failed (from Phase 2 scan)
  } else if (manifestExists && completedStages === totalStages && totalStages > 1) {
    status = 'completed'
  } else if (manifestExists && orchCompleted > 0) {
    status = 'running'
  } else if (manifestExists) {
    // Manifest exists but no stages completed yet — orchestrator just started
    status = 'running'
  } else if (prepAllDone) {
    // All prep steps done, waiting for orchestrator
    status = 'ready'
  } else if (prepDone > 0) {
    // Some prep steps done, but not all
    status = 'preparing'
  } else {
    // No prep steps started
    status = 'pending'
  }

  return {
    name,
    path: projectPath,
    hasObservation,
    status,
    progress,
    stages: totalStages,
    stagesCompleted: completedStages,
    lastUpdate,
    hasAlerts,
    instance,
    prepDetail,
  }
}

/** Helper: find instance directory for a project */
export async function findInstanceDir(workdir: string, projectName: string) {
  const { assertValidWorkdir, assertSafeProjectName } = await import('../utils/paths.js')
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

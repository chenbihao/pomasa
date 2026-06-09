import type { ProjectInfo, Manifest, AgentStatus, LogEvent, Pattern, FileNode, AgentBlueprint, ProjectConfig } from '../types'

const API_BASE = '/api'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ========== File System API ==========

export async function fetchFileTree(dirPath: string, depth = 5): Promise<FileNode[]> {
  const data = await fetchJson<{ tree: FileNode[] }>(
    `${API_BASE}/fs/tree?path=${encodeURIComponent(dirPath)}&depth=${depth}`
  )
  return data.tree
}

export async function fetchFileContent(filePath: string): Promise<string> {
  const data = await fetchJson<{ content: string }>(
    `${API_BASE}/fs/file?path=${encodeURIComponent(filePath)}`
  )
  return data.content
}

export async function fetchSubDirs(dirPath: string): Promise<{ name: string; path: string }[]> {
  const data = await fetchJson<{ dirs: { name: string; path: string }[] }>(
    `${API_BASE}/fs/dirs?path=${encodeURIComponent(dirPath)}`
  )
  return data.dirs
}

export async function fetchDirFingerprints(dirPath: string): Promise<Record<string, number>> {
  try {
    const data = await fetchJson<{ fingerprints: Record<string, number> }>(
      `${API_BASE}/fs/changes?path=${encodeURIComponent(dirPath)}`
    )
    return data.fingerprints
  } catch {
    return {}
  }
}

export async function fetchFileStat(filePath: string): Promise<{ mtimeMs: number; size: number } | null> {
  try {
    return await fetchJson<{ mtimeMs: number; size: number }>(
      `${API_BASE}/fs/stat?path=${encodeURIComponent(filePath)}`
    )
  } catch {
    return null
  }
}

// ========== Projects API ==========

export async function fetchProjects(workdir: string): Promise<ProjectInfo[]> {
  const data = await fetchJson<{ projects: ProjectInfo[] }>(
    `${API_BASE}/projects?workdir=${encodeURIComponent(workdir)}`
  )
  return data.projects
}

export async function fetchManifest(name: string, workdir: string): Promise<Manifest> {
  return fetchJson<Manifest>(
    `${API_BASE}/projects/${encodeURIComponent(name)}/manifest?workdir=${encodeURIComponent(workdir)}`
  )
}

export async function fetchAgentStatuses(name: string, workdir: string): Promise<Record<string, AgentStatus>> {
  try {
    const data = await fetchJson<{ agents: Record<string, AgentStatus> }>(
      `${API_BASE}/projects/${encodeURIComponent(name)}/status?workdir=${encodeURIComponent(workdir)}`
    )
    return data.agents
  } catch {
    // Project may not have status yet (e.g., still preparing)
    return {}
  }
}

export async function fetchEvents(name: string, workdir: string): Promise<LogEvent[]> {
  try {
    const data = await fetchJson<{ events: LogEvent[] }>(
      `${API_BASE}/projects/${encodeURIComponent(name)}/events?workdir=${encodeURIComponent(workdir)}`
    )
    return data.events
  } catch {
    // Project may not have events yet (e.g., still preparing)
    return []
  }
}

export async function fetchAgentLogs(name: string, agentKey: string, workdir: string): Promise<LogEvent[]> {
  const data = await fetchJson<{ logs: LogEvent[] }>(
    `${API_BASE}/projects/${encodeURIComponent(name)}/logs/${agentKey}?workdir=${encodeURIComponent(workdir)}`
  )
  return data.logs
}

export async function fetchAgentBlueprints(name: string, workdir: string): Promise<AgentBlueprint[]> {
  try {
    const data = await fetchJson<{ agents: AgentBlueprint[] }>(
      `${API_BASE}/projects/${encodeURIComponent(name)}/agents?workdir=${encodeURIComponent(workdir)}`
    )
    return data.agents
  } catch {
    return []
  }
}

export async function fetchProjectFileTree(name: string, section: string, workdir: string): Promise<FileNode[]> {
  try {
    const data = await fetchJson<{ tree: FileNode[] }>(
      `${API_BASE}/projects/${encodeURIComponent(name)}/files/${section}?workdir=${encodeURIComponent(workdir)}`
    )
    return data.tree
  } catch {
    return []
  }
}

export async function fetchProjectConfig(name: string, workdir: string): Promise<ProjectConfig> {
  try {
    return await fetchJson<ProjectConfig>(
      `${API_BASE}/projects/${encodeURIComponent(name)}/config?workdir=${encodeURIComponent(workdir)}`
    )
  } catch {
    return { config: null, readme: null, template: null }
  }
}

// ========== Framework API ==========

export async function fetchPatterns(): Promise<Pattern[]> {
  const data = await fetchJson<{ patterns: Pattern[] }>(`${API_BASE}/framework/patterns`)
  return data.patterns
}

export async function fetchGenerator(): Promise<string> {
  const data = await fetchJson<{ content: string }>(`${API_BASE}/framework/generator`)
  return data.content
}

export async function fetchTemplate(): Promise<string> {
  const data = await fetchJson<{ content: string }>(`${API_BASE}/framework/template`)
  return data.content
}

// ========== MAS Creation API ==========

export async function createMas(
  targetDir: string,
  masName: string,
  userInput: Record<string, unknown>,
  selectedPatterns: string[],
  language: string,
  onOutput: (content: string) => void,
  onDone: (masPath: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/mas/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetDir, masName, userInput, selectedPatterns, language }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${response.status}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) return

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n').filter(line => line.startsWith('data: '))

    for (const line of lines) {
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'output') onOutput(data.content)
        else if (data.type === 'error') onError(data.content)
        else if (data.type === 'done') {
          if (data.code === 0) onDone(data.masPath)
          else onError(data.error || 'Creation failed')
        }
      } catch { /* skip malformed lines */ }
    }
  }
}

// ========== WebSocket Terminal ==========

export function getTerminalWebSocketUrl(): string {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${window.location.host}/api/terminal`
}

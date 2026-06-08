/** Project information returned by /api/projects */
export interface ProjectInfo {
  name: string
  path: string
  hasObservation: boolean
  status: 'running' | 'completed' | 'failed' | 'unknown' | 'pending'
  progress: number
  stages: number
  stagesCompleted: number
  lastUpdate: string | null
  hasAlerts: boolean
  instance: string | null
}

/** Run manifest (run_manifest.json) */
export interface Manifest {
  instance: string
  created: string
  stages: Stage[]
}

/** A single stage in the run manifest */
export interface Stage {
  id: string
  agent: string
  depends_on: string[]
  fanout: string
}

/** Status of a single agent (assigned + self) */
export interface AgentStatus {
  assigned: { state: string; ts: string; detail?: string; result?: string } | null
  self: { state: string; ts: string; detail?: string } | null
}

/** A single log event from JSONL */
export interface LogEvent {
  ts: string
  level: string
  agent: string
  instance: string
  event: string
  msg: string
  key: string
  stage?: string
  result?: string
  blueprint?: string
  path?: string
}

/** Pattern information from /api/framework/patterns */
export interface Pattern {
  id: string
  name: string
  category: string
  necessity: string
  description: string
}

/** File tree node from /api/fs/tree */
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

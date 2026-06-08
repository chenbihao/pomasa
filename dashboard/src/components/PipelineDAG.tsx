import { useMemo, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ReactFlow, { Background, Controls, Handle, Position, type Node, type Edge, MarkerType, useReactFlow } from 'reactflow'
import type { NodeProps } from 'reactflow'
import { getStatusConfig } from '../theme/statusColors'
import type { Stage, AgentStatus } from '../types'
import 'reactflow/dist/style.css'

interface PipelineDAGProps {
  stages: Stage[]
  statuses: Record<string, AgentStatus>
  onNodeClick?: (nodeId: string) => void
}

function OrchestratorNode({ data }: NodeProps) {
  const { t } = useTranslation()
  const { activeStages, completedStages, totalStages } = data as { activeStages: number; completedStages: number; totalStages: number }
  return (
    <div className="bg-purple-50 rounded-xl border-2 border-purple-400 shadow-md px-5 py-4 min-w-[220px]">
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-sm text-purple-800">{t('pipeline.orchestrator')}</div>
          <div className="text-xs text-purple-600">00.orchestrator</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-purple-700">
        <span>{completedStages}/{totalStages} {t('pipeline.done')}</span>
        {activeStages > 0 && (
          <span className="flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            {activeStages} {t('pipeline.active')}
          </span>
        )}
      </div>
    </div>
  )
}

function AgentNode({ data }: NodeProps) {
  const { label, agent, state, selfState, detail } = data as { label: string; agent: string; state: string; selfState?: string; detail?: string }
  const config = getStatusConfig(state)
  const Icon = config.icon
  const isRunning = state === 'running'
  const isDone = state === 'done' || state === 'completed'
  const isFailed = state === 'failed' || state === 'error' || state === 'timed_out'

  return (
    <div
      className="bg-white rounded-xl border-2 shadow-sm px-4 py-3 min-w-[200px] cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderColor: config.hex }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm text-gray-800">{label}</span>
        {isRunning && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        )}
        {isDone && <Icon className="w-4 h-4 text-green-500" />}
        {isFailed && <Icon className="w-4 h-4 text-red-500" />}
      </div>
      <div className="text-xs text-gray-500 mb-2">{agent}</div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: config.hex }}
        />
        <span className="text-xs font-medium" style={{ color: config.hex }}>{state}</span>
        {selfState && selfState !== state && (
          <span className="text-xs text-gray-400">(self: {selfState})</span>
        )}
      </div>
      {detail && (
        <div className="text-xs text-gray-400 mt-1 truncate" title={detail}>
          {detail}
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  orchestrator: OrchestratorNode,
  agent: AgentNode,
}

/** Triggers fitView when the container resizes (e.g., becomes visible after being hidden). */
function FitViewOnResize() {
  const { fitView } = useReactFlow()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current?.closest('.react-flow')
    if (!container) return

    const observer = new ResizeObserver(() => {
      // Only fit if container has non-zero dimensions
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        fitView({ padding: 0.3, duration: 0 })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [fitView])

  return <div ref={containerRef} style={{ display: 'none' }} />
}

export default function PipelineDAG({ stages, statuses, onNodeClick }: PipelineDAGProps) {
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeClick?.(node.id),
    [onNodeClick],
  )

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    const completedStages = stages.filter(s => {
      const state = statuses[s.id]?.assigned?.state
      return state === 'done' || state === 'completed'
    }).length
    const activeStages = stages.filter(s => statuses[s.id]?.assigned?.state === 'running').length

    nodes.push({
      id: 'orchestrator',
      type: 'orchestrator',
      position: { x: 50, y: 0 },
      data: { activeStages, completedStages, totalStages: stages.length },
    })

    const sorted = topologicalSort(stages)

    const levelMap = new Map<string, number>()
    for (const stage of sorted) {
      const maxParentLevel = stage.depends_on.reduce((max, dep) => {
        return Math.max(max, levelMap.get(dep) ?? -1)
      }, -1)
      levelMap.set(stage.id, maxParentLevel + 1)
    }

    const levels = new Map<number, Stage[]>()
    for (const stage of sorted) {
      const level = levelMap.get(stage.id) ?? 0
      if (!levels.has(level)) levels.set(level, [])
      levels.get(level)!.push(stage)
    }

    const xGap = 280
    const yGap = 180
    const startY = 150

    for (const [level, levelStages] of levels) {
      levelStages.forEach((stage, i) => {
        const status = statuses[stage.id]
        const assignedState = status?.assigned?.state ?? 'pending'
        const selfState = status?.self?.state
        const detail = status?.assigned?.detail

        nodes.push({
          id: stage.id,
          type: 'agent',
          position: { x: level * xGap + 50, y: startY + i * yGap },
          data: { label: stage.id, agent: stage.agent, state: assignedState, selfState, detail },
        })

        const orchEdgeColor = '#c084fc'
        edges.push({
          id: `orch-${stage.id}`,
          source: 'orchestrator',
          target: stage.id,
          animated: assignedState === 'running',
          style: { stroke: orchEdgeColor, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: orchEdgeColor },
        })
      })
    }

    for (const stage of stages) {
      for (const dep of stage.depends_on) {
        const targetState = statuses[stage.id]?.assigned?.state ?? 'pending'
        const depColor = targetState === 'done' || targetState === 'completed' ? '#16a34a' : '#94a3b8'
        edges.push({
          id: `${dep}-${stage.id}`,
          source: dep,
          target: stage.id,
          animated: targetState === 'running',
          style: { stroke: depColor, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: depColor },
        })
      }
    }

    return { nodes, edges }
  }, [stages, statuses])

  return (
    <div className="w-full h-full min-h-[400px] min-w-[300px] border rounded-xl bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        attributionPosition="bottom-left"
        minZoom={0.5}
        maxZoom={2}
        nodesDraggable={true}
        nodesConnectable={false}
        panOnDrag={true}
        selectionOnDrag={false}
      >
        <Background />
        <Controls />
        <FitViewOnResize />
      </ReactFlow>
    </div>
  )
}

function topologicalSort(stages: Stage[]): Stage[] {
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const result: Stage[] = []
  const stageMap = new Map(stages.map(s => [s.id, s]))

  function visit(id: string): boolean {
    if (visited.has(id)) return true
    if (inStack.has(id)) return false // cycle detected
    inStack.add(id)
    const stage = stageMap.get(id)
    if (!stage) return true
    for (const dep of stage.depends_on) {
      if (!visit(dep)) return false // cycle in dependency
    }
    inStack.delete(id)
    visited.add(id)
    result.push(stage)
    return true
  }

  for (const stage of stages) {
    if (!visit(stage.id)) {
      console.warn(`Cycle detected involving stage: ${stage.id}`)
    }
  }

  return result
}

import { Play, CheckCircle, XCircle, Clock, AlertTriangle, Ban, Info, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface StatusConfig {
  icon: LucideIcon
  color: string
  bg: string
  /** Tailwind border color class, e.g. 'border-blue-200' */
  border: string
  /** Solid color hex for ReactFlow edges/nodes */
  hex: string
  /** i18n key for the label */
  labelKey: string
}

/**
 * Single source of truth for all status colors and icons.
 * Every component that displays a status should import from here.
 */
export const statusColors: Record<string, StatusConfig> = {
  pending: {
    icon: Clock,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    hex: '#6b7280',
    labelKey: 'status.pending',
  },
  preparing: {
    icon: Play,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hex: '#d97706',
    labelKey: 'status.preparing',
  },
  ready: {
    icon: ArrowRight,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hex: '#3b82f6',
    labelKey: 'status.ready',
  },
  running: {
    icon: Play,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hex: '#2563eb',
    labelKey: 'status.running',
  },
  done: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    hex: '#16a34a',
    labelKey: 'status.done',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    hex: '#16a34a',
    labelKey: 'status.completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    hex: '#dc2626',
    labelKey: 'status.failed',
  },
  timed_out: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    hex: '#ea580c',
    labelKey: 'status.timedOut',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    hex: '#dc2626',
    labelKey: 'status.error',
  },
  superseded: {
    icon: Ban,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    hex: '#6b7280',
    labelKey: 'status.superseded',
  },
  unknown: {
    icon: Clock,
    color: 'text-gray-400',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    hex: '#9ca3af',
    labelKey: 'status.pending',
  },
}

/**
 * Get the config for a given status, falling back to 'pending'.
 */
export function getStatusConfig(state: string): StatusConfig {
  return statusColors[state] ?? statusColors.pending
}

/**
 * Event level colors (INFO / WARN / ERROR) — used by EventTimeline and log panels.
 */
export const levelColors: Record<string, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  INFO: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  WARN: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  ERROR: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

/**
 * Event type → i18n key mapping.
 * Used by EventTimeline and agent log panels to display localized event names.
 */
export const EVENT_I18N_KEYS: Record<string, string> = {
  agent_call: 'events.agentCall',
  stage_verdict: 'events.stageVerdict',
  task_start: 'events.taskStart',
  task_done: 'events.taskDone',
  tool_fallback: 'events.toolFallback',
  error: 'events.error',
}

/**
 * Event type → badge style classes.
 */
export const EVENT_STYLES: Record<string, string> = {
  agent_call: 'bg-blue-100 text-blue-700',
  stage_verdict: 'bg-emerald-100 text-emerald-700',
  task_start: 'bg-gray-100 text-gray-600',
  task_done: 'bg-green-100 text-green-700',
  tool_fallback: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
}

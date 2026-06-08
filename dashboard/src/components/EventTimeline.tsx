import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Filter, Clock } from 'lucide-react'
import { levelColors } from '../theme/statusColors'
import type { LogEvent } from '../types'

interface EventTimelineProps {
  events: LogEvent[]
}

const eventConfig: Record<string, { label: string; color: string }> = {
  agent_call: { label: 'Agent Call', color: 'text-blue-600' },
  stage_verdict: { label: 'Stage Verdict', color: 'text-green-600' },
  task_start: { label: 'Task Start', color: 'text-gray-600' },
  task_done: { label: 'Task Done', color: 'text-green-600' },
  tool_fallback: { label: 'Tool Fallback', color: 'text-yellow-600' },
  error: { label: 'Error', color: 'text-red-600' },
}

export default function EventTimeline({ events }: EventTimelineProps) {
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const { t } = useTranslation()

  const agents = [...new Set(events.map(e => e.agent))].sort()

  const filtered = events.filter(e => {
    if (agentFilter !== 'all' && e.agent !== agentFilter) return false
    if (levelFilter !== 'all' && e.level !== levelFilter) return false
    return true
  })

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString()
    } catch {
      return ts
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-white">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="all">{t('events.allAgents')}</option>
          {agents.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="all">{t('events.allLevels')}</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} {t('events.eventsCount')}</span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-8">{t('events.noEvents')}</div>
        ) : (
          <div className="divide-y">
            {filtered.map((event, i) => {
              const config = levelColors[event.level] ?? levelColors.INFO
              const Icon = config.icon
              const eventInfo = eventConfig[event.event]
              const isVerdict = event.event === 'stage_verdict'
              const resultColor = event.result === 'pass' ? 'text-green-600' : 'text-red-600'

              return (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 ${isVerdict ? 'bg-gray-50' : ''}`}>
                  <div className={`mt-0.5 p-1 rounded ${config.bg} border ${config.border}`}>
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{event.agent}</span>
                      {event.stage && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded font-mono">
                          {event.stage}
                        </span>
                      )}
                      {eventInfo ? (
                        <span className={`text-xs font-medium ${eventInfo.color}`}>
                          {eventInfo.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono">{event.event}</span>
                      )}
                      {isVerdict && event.result && (
                        <span className={`text-xs font-bold ${resultColor}`}>
                          [{event.result.toUpperCase()}]
                        </span>
                      )}
                      <span className="flex-1" />
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(event.ts)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{event.msg}</p>
                    {event.blueprint && (
                      <p className="text-xs text-gray-400 mt-1">
                        {t('events.blueprint')}: {event.blueprint}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

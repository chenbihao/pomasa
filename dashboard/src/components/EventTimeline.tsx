import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Filter } from 'lucide-react'
import { levelColors, EVENT_I18N_KEYS, EVENT_STYLES } from '../theme/statusColors'
import type { LogEvent } from '../types'

interface EventTimelineProps {
  events: LogEvent[]
}

function agentColor(agent: string): string {
  if (agent.includes('orchestrator')) return 'text-purple-700'
  return 'text-emerald-700'
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
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {filtered.map((event, i) => {
                const config = levelColors[event.level] ?? levelColors.INFO
                const Icon = config.icon
                const i18nKey = EVENT_I18N_KEYS[event.event]
                const eventLabel = i18nKey ? t(i18nKey) : event.event
                const eventStyle = EVENT_STYLES[event.event] ?? 'bg-gray-100 text-gray-600'
                const isVerdict = event.event === 'stage_verdict'
                const resultColor = event.result === 'pass' ? 'text-green-600' : 'text-red-600'

                return (
                  <tr key={i} className={`hover:bg-gray-50 ${isVerdict ? 'bg-gray-50/50' : ''}`}>
                    {/* Time */}
                    <td className="px-3 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap align-top w-[72px]">
                      {formatTime(event.ts)}
                    </td>

                    {/* Level */}
                    <td className="px-1.5 py-2.5 align-top w-6">
                      <div className={`mt-0.5 p-0.5 rounded ${config.bg} border ${config.border}`}>
                        <Icon className={`w-3 h-3 ${config.color}`} />
                      </div>
                    </td>

                    {/* Content */}
                    <td className="px-2 py-2.5 align-top">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className={`font-medium text-xs ${agentColor(event.agent)}`}>{event.agent}</span>
                        {event.stage && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-mono">
                            {event.stage}
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${eventStyle}`}>
                          {eventLabel}
                        </span>
                        {isVerdict && event.result && (
                          <span className={`text-[11px] font-bold ${resultColor}`}>
                            [{event.result.toUpperCase()}]
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-xs leading-relaxed">{event.msg}</p>
                      {event.blueprint && (
                        <p className="text-gray-400 text-[11px] mt-0.5">
                          {t('events.blueprint')}: {event.blueprint}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

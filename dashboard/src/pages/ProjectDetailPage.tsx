import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileText, XCircle } from 'lucide-react'
import { getStatusConfig, levelColors } from '../theme/statusColors'
import { usePageVisibility } from '../hooks/usePageVisibility'
import { fetchManifest, fetchAgentStatuses, fetchEvents, fetchAgentLogs } from '../api'
import type { Manifest, AgentStatus, LogEvent } from '../types'
import PipelineDAG from '../components/PipelineDAG'
import EventTimeline from '../components/EventTimeline'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'

interface ProjectDetailPageProps {
  workDir: string
}

type SubTab = 'dag' | 'events' | 'status'

const subTabs: { key: SubTab; icon: typeof FileText; labelKey: string }[] = [
  { key: 'dag', icon: FileText, labelKey: 'project.pipeline' },
  { key: 'events', icon: FileText, labelKey: 'project.events' },
  { key: 'status', icon: FileText, labelKey: 'project.status' },
]

export default function ProjectDetailPage({ workDir }: ProjectDetailPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isVisible = usePageVisibility()

  const name = useMemo(() => {
    const match = location.pathname.match(/^\/project\/(.+)$/)
    return match ? decodeURIComponent(match[1]) : undefined
  }, [location.pathname])

  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({})
  const [events, setEvents] = useState<LogEvent[]>([])
  const [activeTab, setActiveTab] = useState<SubTab>('dag')
  const [loading, setLoading] = useState(true)

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [agentLogs, setAgentLogs] = useState<LogEvent[]>([])
  const [showAgentLog, setShowAgentLog] = useState(false)

  const fetchData = useCallback(async () => {
    if (!name || !workDir) return

    try {
      const [manifestData, statusData, eventsData] = await Promise.all([
        fetchManifest(name, workDir).catch(() => null),
        fetchAgentStatuses(name, workDir).catch(() => ({})),
        fetchEvents(name, workDir).catch(() => []),
      ])

      setManifest(manifestData)
      setStatuses(statusData)
      setEvents(eventsData)
    } catch (err) {
      console.error('Failed to fetch project data:', err)
    } finally {
      setLoading(false)
    }
  }, [name, workDir])

  useEffect(() => {
    fetchData()
    if (!isVisible) return
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData, isVisible])

  const handleNodeClick = (nodeId: string) => {
    if (nodeId === 'orchestrator') {
      setSelectedAgent('00.orchestrator')
      setAgentLogs(events.filter(e => e.agent === '00.orchestrator'))
      setShowAgentLog(true)
    } else {
      fetchAgentLog(nodeId)
    }
  }

  const handleTabChange = (tab: SubTab) => {
    setActiveTab(tab)
    if (tab !== 'dag') setShowAgentLog(false)
  }

  const handleStatusLogClick = (stageId: string) => {
    setActiveTab('dag')
    fetchAgentLog(stageId)
  }

  const fetchAgentLog = async (agentKey: string) => {
    if (!name || !workDir) return
    setSelectedAgent(agentKey)
    try {
      const logs = await fetchAgentLogs(name, agentKey, workDir)
      setAgentLogs(logs)
    } catch {
      setAgentLogs([])
    }
    setShowAgentLog(true)
  }

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleString() } catch { return ts }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('project.loading')}
      </div>
    )
  }

  if (!manifest) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="mb-4">{t('project.failed')}</p>
        <Button variant="ghost" onClick={() => navigate('/')}>
          {t('project.back')}
        </Button>
      </div>
    )
  }

  if (manifest.stages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          onBack={() => navigate('/')}
          title={name!}
          subtitle={manifest.instance ? `${t('project.instance')}: ${manifest.instance}` : undefined}
        />
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm">{t('project.notStarted')}</p>
          <p className="text-xs text-gray-400">{t('project.notStartedHint')}</p>
        </div>
      </div>
    )
  }

  const totalStages = manifest.stages.length
  const completedStages = manifest.stages.filter(s => {
    const state = statuses[s.id]?.assigned?.state
    return state === 'done' || state === 'completed'
  }).length
  const runningStages = manifest.stages.filter(s => statuses[s.id]?.assigned?.state === 'running').length
  const hasAlerts = events.some(e => e.level === 'WARN' || e.level === 'ERROR')

  const headerActions = (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
        <span className="text-sm text-gray-600">
          {completedStages}/{totalStages} {t('dashboard.stages')}
        </span>
        <div className="w-20 h-2 bg-gray-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${totalStages > 0 ? (completedStages / totalStages) * 100 : 0}%` }}
          />
        </div>
      </div>
      {runningStages > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          {runningStages} {t('project.running')}
        </div>
      )}
      {hasAlerts && (
        <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-xs">
          <AlertTriangle className="w-3 h-3" />
          {t('project.hasAlerts')}
        </div>
      )}
    </>
  )

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        onBack={() => navigate('/')}
        title={name!}
        subtitle={`${t('project.instance')}: ${manifest.instance} | ${t('project.created')}: ${formatTime(manifest.created)}`}
        actions={headerActions}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-tab bar */}
        <div className="bg-white border-b px-4 flex items-center gap-1">
          {subTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {t(tab.labelKey)}
              {tab.key === 'events' && ` (${events.length})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex">
          <div className={`flex-1 overflow-hidden ${showAgentLog && activeTab === 'dag' ? 'w-1/2' : 'w-full'}`}>
            {activeTab === 'dag' && (
              <div className="h-full p-4">
                <PipelineDAG stages={manifest.stages} statuses={statuses} onNodeClick={handleNodeClick} />
              </div>
            )}

            {activeTab === 'events' && (
              <EventTimeline events={events} />
            )}

            {activeTab === 'status' && (
              <div className="overflow-auto p-4">
                <div className="max-w-4xl mx-auto">
                  {/* Status Legend */}
                  <Card className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">{t('project.statusLegend')}</h3>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {['done', 'running', 'pending', 'failed', 'timed_out'].map(s => {
                        const cfg = getStatusConfig(s)
                        return (
                          <div key={s} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.hex }} />
                            <span>{t(cfg.labelKey)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      <strong>{t('project.assigned')}</strong> | <strong>{t('project.self')}</strong>
                    </p>
                  </Card>

                  {/* Status Table */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3 text-sm font-medium text-gray-600 border-b">Stage</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600 border-b">Agent</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600 border-b">{t('project.assigned')}</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600 border-b">{t('project.self')}</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600 border-b">{t('project.lastUpdate')}</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600 border-b">{t('project.log')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manifest.stages.map(stage => {
                        const status = statuses[stage.id]
                        const assignedState = status?.assigned?.state ?? 'pending'
                        const selfState = status?.self?.state
                        const assignedCfg = getStatusConfig(assignedState)
                        const selfCfg = selfState ? getStatusConfig(selfState) : null
                        const AssignedIcon = assignedCfg.icon
                        const SelfIcon = selfCfg?.icon
                        const isDivergent = selfState && selfState !== assignedState

                        return (
                          <tr key={stage.id} className="hover:bg-gray-50 border-b">
                            <td className="p-3">
                              <div className="font-medium text-sm">{stage.id}</div>
                              {stage.depends_on.length > 0 && (
                                <div className="text-xs text-gray-400">
                                  {t('project.depends')}: {stage.depends_on.join(', ')}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-sm text-gray-600">{stage.agent}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <AssignedIcon className={`w-4 h-4 ${assignedCfg.color}`} />
                                <span className={`text-sm font-medium ${assignedCfg.color}`}>
                                  {assignedState}
                                </span>
                              </div>
                              {status?.assigned?.detail && (
                                <div className="text-xs text-gray-400 mt-1">{status.assigned.detail}</div>
                              )}
                              {status?.assigned?.result && (
                                <div className={`text-xs mt-1 ${status.assigned.result === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
                                  result: {status.assigned.result}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {selfState ? (
                                <div className="flex items-center gap-2">
                                  {SelfIcon && <SelfIcon className={`w-4 h-4 ${selfCfg!.color}`} />}
                                  <span className={`text-sm ${selfCfg!.color}`}>
                                    {selfState}
                                  </span>
                                  {isDivergent && (
                                    <span className="text-xs text-orange-500">({t('project.divergent')})</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-3 text-xs text-gray-500">
                              {status?.assigned?.ts
                                ? formatTime(status.assigned.ts)
                                : status?.self?.ts
                                  ? formatTime(status.self.ts)
                                  : '-'}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStatusLogClick(stage.id)}
                                title={t('project.viewLog')}
                              >
                                <FileText className="w-4 h-4 text-gray-500" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Agent Log Panel */}
          {showAgentLog && activeTab === 'dag' && (
            <div className="w-1/2 border-l bg-gray-50 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm">
                    {selectedAgent === '00.orchestrator' ? t('project.orchestratorLog') : `${t('project.agentLog')}: ${selectedAgent}`}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAgentLog(false)}>
                  <XCircle className="w-4 h-4 text-gray-500" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {agentLogs.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    {t('project.noLogEntries')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agentLogs.map((log, i) => {
                      const lc = levelColors[log.level] ?? levelColors.INFO

                      return (
                        <Card key={i} noPadding className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${lc.color} ${lc.bg}`}>
                              {log.level}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">{log.event}</span>
                            <span className="flex-1" />
                            <span className="text-xs text-gray-400">
                              {formatTime(log.ts)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{log.msg}</p>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

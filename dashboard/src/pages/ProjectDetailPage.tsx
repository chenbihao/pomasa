import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, FileText, XCircle, BookOpen, FolderTree, Info, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { getStatusConfig, levelColors } from '../theme/statusColors'
import { usePageVisibility } from '../hooks/usePageVisibility'
import { fetchManifest, fetchAgentStatuses, fetchEvents, fetchAgentLogs, fetchAgentBlueprints, fetchProjectFileTree, fetchProjectConfig, fetchFileContent } from '../api'
import type { Manifest, AgentStatus, LogEvent, AgentBlueprint, ProjectConfig, FileNode } from '../types'
import PipelineDAG from '../components/PipelineDAG'
import EventTimeline from '../components/EventTimeline'
import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import Button from '../components/Button'
import MilkdownViewer from '../components/MilkdownViewer'
import { FileTreeItem } from '../components/FileTree'

interface ProjectDetailPageProps {
  workDir: string
}

type SubTab = 'dag' | 'events' | 'status' | 'blueprints' | 'files' | 'overview'
type FileSection = 'references' | 'workspace' | 'wip' | 'agents' | 'scripts' | 'library' | 'wiki' | '_output'

const FILE_SECTIONS: FileSection[] = ['agents', 'references', 'workspace', 'wip', 'scripts', 'library', 'wiki', '_output']
type AgentPanelTab = 'logs' | 'blueprint'

const subTabs: { key: SubTab; icon: typeof FileText; labelKey: string }[] = [
  { key: 'dag', icon: FileText, labelKey: 'project.pipeline' },
  { key: 'events', icon: FileText, labelKey: 'project.events' },
  { key: 'status', icon: FileText, labelKey: 'project.status' },
  { key: 'blueprints', icon: BookOpen, labelKey: 'project.blueprints' },
  { key: 'files', icon: FolderTree, labelKey: 'project.files' },
  { key: 'overview', icon: Info, labelKey: 'project.overview' },
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
  const [fitViewTrigger, setFitViewTrigger] = useState(0)
  const [agentPanelTab, setAgentPanelTab] = useState<AgentPanelTab>('logs')

  // Blueprints state
  const [blueprints, setBlueprints] = useState<AgentBlueprint[]>([])
  const [selectedBlueprint, setSelectedBlueprint] = useState<AgentBlueprint | null>(null)

  // Files state
  const [fileSection, setFileSection] = useState<FileSection>('references')
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileExpandedPaths, setFileExpandedPaths] = useState<Set<string>>(new Set())
  const [fileLoading, setFileLoading] = useState(false)
  const [fileContentLoading, setFileContentLoading] = useState(false)

  // Overview state
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchData = useCallback(async () => {
    if (!name || !workDir) return

    try {
      const [manifestData, statusData, eventsData, blueprintsData, configData] = await Promise.all([
        fetchManifest(name, workDir).catch(() => null),
        fetchAgentStatuses(name, workDir),
        fetchEvents(name, workDir),
        fetchAgentBlueprints(name, workDir),
        fetchProjectConfig(name, workDir),
      ])

      setManifest(manifestData)
      setStatuses(statusData)
      setEvents(eventsData)
      setBlueprints(blueprintsData)
      setProjectConfig(configData)

      // Auto-select first blueprint if none selected
      if (blueprintsData.length > 0) {
        setSelectedBlueprint(prev => prev ?? blueprintsData[0])
      }
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
    setFitViewTrigger(prev => prev + 1)
    setAgentPanelTab('logs')
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

  const getAgentBlueprint = (agentKey: string): AgentBlueprint | undefined => {
    // First try direct match
    const directMatch = blueprints.find(bp => bp.name === agentKey || bp.fileName === `${agentKey}.md`)
    if (directMatch) return directMatch

    // If not found, try to find the agent name from manifest stages
    // This handles the case where agentKey is a stage.id (e.g., "03.report")
    // but the blueprint is named after stage.agent (e.g., "03.reporter")
    if (manifest) {
      const stage = manifest.stages.find(s => s.id === agentKey)
      if (stage && stage.agent !== agentKey) {
        return blueprints.find(bp => bp.name === stage.agent || bp.fileName === `${stage.agent}.md`)
      }
    }

    return undefined
  }

  const handleStatusLogClick = (stageId: string) => {
    setActiveTab('dag')
    fetchAgentLog(stageId)
  }

  const fetchAgentLog = async (agentKey: string) => {
    if (!name || !workDir) return
    // Find the agent name from manifest stages if agentKey is a stage.id
    const stage = manifest?.stages.find(s => s.id === agentKey)
    const displayName = stage ? stage.agent : agentKey
    setSelectedAgent(displayName)
    try {
      const logs = await fetchAgentLogs(name, agentKey, workDir)
      setAgentLogs(logs)
    } catch {
      setAgentLogs([])
    }
    setShowAgentLog(true)
  }

  // File tree for files tab
  const loadFileTree = useCallback(async (section: FileSection) => {
    if (!name || !workDir) return
    setFileLoading(true)
    try {
      const tree = await fetchProjectFileTree(name, section, workDir)
      setFileTree(tree)
      // Auto-expand root directories
      const rootDirs = new Set<string>()
      tree.forEach(node => { if (node.type === 'directory') rootDirs.add(node.path) })
      setFileExpandedPaths(rootDirs)
    } catch {
      setFileTree([])
    } finally {
      setFileLoading(false)
    }
  }, [name, workDir])

  const handleFileSectionChange = (section: FileSection) => {
    setFileSection(section)
    setSelectedFile(null)
    setFileContent('')
    loadFileTree(section)
  }

  const handleFileSelect = useCallback(async (filePath: string) => {
    setSelectedFile(filePath)
    setFileContentLoading(true)
    try {
      const content = await fetchFileContent(filePath)
      setFileContent(content)
    } catch {
      setFileContent('Failed to load file content')
    } finally {
      setFileContentLoading(false)
    }
  }, [])

  const handleFileToggle = (path: string) => {
    setFileExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // Load file tree when files tab is first shown (via handleTabChange)
  useEffect(() => {
    if (activeTab === 'files' && fileTree.length === 0 && name && workDir) {
      loadFileTree(fileSection)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString()
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

  const hasPrep = manifest.prepStages && manifest.prepStages.length > 0

  if (manifest.stages.length === 0 && !hasPrep) {
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

  // Orchestrator = 1 stage (done when all prep steps complete)
  const orchDone = hasPrep && manifest.prepStages.every(s => s.state === 'done') ? 1 : 0
  const manifestDone = manifest.stages.filter(s => {
    const state = statuses[s.id]?.assigned?.state
    return state === 'done' || state === 'completed'
  }).length
  const totalStages = 1 + manifest.stages.length
  const completedStages = orchDone + manifestDone
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
            className={`h-full rounded-full transition-all ${
              completedStages === totalStages ? 'bg-green-500' : 'bg-blue-500'
            }`}
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
        subtitle={`${t('project.instance')}: ${manifest.instance ?? '-'} | ${t('project.created')}: ${formatTime(manifest.created ?? '')}`}
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
                <PipelineDAG stages={manifest.stages} statuses={statuses} prepStages={manifest.prepStages} onNodeClick={handleNodeClick} fitViewTrigger={fitViewTrigger} />
              </div>
            )}

            {activeTab === 'events' && (
              <EventTimeline events={events} />
            )}

            {activeTab === 'status' && (
              <div className="h-full overflow-auto p-4">
                <div className="max-w-4xl mx-auto">
                  {/* Preparation Stages */}
                  {manifest.prepStages && manifest.prepStages.length > 0 && (
                    <Card className="mb-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">{t('pipeline.preparation')}</h3>
                      <div className="flex items-center gap-3">
                        {manifest.prepStages.map((stage, i) => (
                          <div key={stage.id} className="flex items-center gap-2">
                            {stage.state === 'done' ? (
                              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : stage.state === 'running' ? (
                              <span className="relative flex h-5 w-5 flex-shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500" />
                              </span>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                            )}
                            <div>
                              <div className={`text-xs font-medium ${stage.state === 'done' ? 'text-green-700' : stage.state === 'running' ? 'text-amber-700' : 'text-gray-500'}`}>
                                {stage.id} {stage.label}
                                {stage.detail && <span className="ml-1 text-gray-400">({stage.detail})</span>}
                              </div>
                              {stage.ts && (
                                <div className="text-xs text-gray-400">{formatTime(stage.ts)}</div>
                              )}
                            </div>
                            {i < manifest.prepStages.length - 1 && (
                              <div className={`w-8 h-0.5 mx-1 ${stage.state === 'done' ? 'bg-green-300' : stage.state === 'running' ? 'bg-amber-300' : 'bg-gray-200'}`} />
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

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

            {/* Blueprints Tab */}
            {activeTab === 'blueprints' && (
              <div className="flex h-full">
                {/* Agent list sidebar */}
                <aside className="w-64 border-r bg-white flex flex-col shrink-0">
                  <div className="px-3 py-2 border-b bg-gray-50">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('project.agentDef')}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {blueprints.length === 0 ? (
                      <div className="text-center text-gray-400 py-8 text-sm">{t('project.noBlueprint')}</div>
                    ) : (
                      blueprints.map(bp => (
                        <button
                          key={bp.name}
                          onClick={() => setSelectedBlueprint(bp)}
                          className={`w-full text-left px-3 py-2.5 border-b transition-colors ${
                            selectedBlueprint?.name === bp.name
                              ? 'bg-blue-50 text-blue-700 border-l-2 border-l-blue-500'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="text-sm font-medium">{bp.name}</div>
                          <div className="text-xs text-gray-400">{bp.fileName}</div>
                        </button>
                      ))
                    )}
                  </div>
                </aside>

                {/* Blueprint content */}
                <main className="flex-1 overflow-y-auto bg-white">
                  {selectedBlueprint ? (
                    <div className="max-w-4xl mx-auto p-6">
                      <h2 className="text-sm text-gray-500 mb-4 font-mono pb-2 border-b">
                        {selectedBlueprint.fileName}
                      </h2>
                      <article>
                        <MilkdownViewer key={selectedBlueprint.name} content={selectedBlueprint.content} />
                      </article>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center mt-20">
                      {t('project.selectAgent')}
                    </div>
                  )}
                </main>
              </div>
            )}

            {/* Files Tab */}
            {activeTab === 'files' && (
              <div className="flex flex-col h-full">
                {/* Section switcher */}
                <div className="flex items-center gap-1 px-4 py-2 border-b bg-gray-50">
                  {FILE_SECTIONS.map(section => (
                    <button
                      key={section}
                      onClick={() => handleFileSectionChange(section)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        fileSection === section
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t(`project.${section}`)}
                    </button>
                  ))}
                  <span className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/viewer?path=${encodeURIComponent(name ? `${workDir}/${name}` : workDir)}`)}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    {t('project.openInViewer')}
                  </Button>
                </div>

                {/* File tree + content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* File tree sidebar */}
                  <aside className="w-72 border-r bg-white flex flex-col shrink-0">
                    <div className="flex-1 overflow-y-auto py-1">
                      {fileLoading ? (
                        <div className="text-center text-gray-400 py-8 text-sm">{t('viewer.loading')}</div>
                      ) : fileTree.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 text-sm">{t('project.noFiles')}</div>
                      ) : (
                        fileTree.map(node => (
                          <FileTreeItem
                            key={node.path}
                            node={node}
                            depth={0}
                            onSelect={handleFileSelect}
                            selectedPath={selectedFile}
                            expandedPaths={fileExpandedPaths}
                            onToggle={handleFileToggle}
                          />
                        ))
                      )}
                    </div>
                  </aside>

                  {/* File content */}
                  <main className="flex-1 overflow-y-auto bg-white">
                    {selectedFile ? (
                      fileContentLoading ? (
                        <div className="text-center text-gray-400 py-20">{t('viewer.loading')}</div>
                      ) : (
                      <div className="max-w-4xl mx-auto p-6">
                        <h2 className="text-sm text-gray-500 mb-4 font-mono pb-2 border-b">
                          {selectedFile}
                        </h2>
                        {selectedFile.endsWith('.md') ? (
                          <article>
                            <MilkdownViewer key={selectedFile} content={fileContent} />
                          </article>
                        ) : (
                          <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto">
                            {fileContent}
                          </pre>
                        )}
                      </div>
                      )
                    ) : (
                      <div className="text-gray-400 text-center mt-20">
                        {t('project.selectFile')}
                      </div>
                    )}
                  </main>
                </div>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="h-full overflow-auto p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                  {(['config', 'readme', 'template'] as const).map(section => {
                    const isCollapsed = collapsedSections.has(section)
                    const content = section === 'config' ? projectConfig?.config
                      : section === 'readme' ? projectConfig?.readme
                      : projectConfig?.template
                    const labelKey = `project.${section}`
                    const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown

                    return (
                      <Card key={section}>
                        <button
                          className="w-full flex items-center justify-between text-left"
                          onClick={() => toggleSection(section)}
                        >
                          <h3 className="text-sm font-medium text-gray-700">{t(labelKey)}</h3>
                          <ChevronIcon className="w-4 h-4 text-gray-400 transition-transform" />
                        </button>
                        {!isCollapsed && (
                          <div className="mt-3">
                            {content ? (
                              section === 'config' ? (
                                <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto">
                                  {content}
                                </pre>
                              ) : (
                                <article>
                                  <MilkdownViewer key={section} content={content} />
                                </article>
                              )
                            ) : (
                              <p className="text-sm text-gray-400">-</p>
                            )}
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Agent Detail Panel (DAG tab only) */}
          {showAgentLog && activeTab === 'dag' && (
            <div className="w-1/2 border-l bg-gray-50 flex flex-col">
              {/* Panel header with tab switcher */}
              <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">
                    {selectedAgent === '00.orchestrator' ? t('project.orchestratorLog') : selectedAgent}
                  </span>
                  <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
                    <button
                      onClick={() => setAgentPanelTab('logs')}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        agentPanelTab === 'logs' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t('project.logs')}
                    </button>
                    <button
                      onClick={() => setAgentPanelTab('blueprint')}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        agentPanelTab === 'blueprint' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t('project.blueprints')}
                    </button>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAgentLog(false)}>
                  <XCircle className="w-4 h-4 text-gray-500" />
                </Button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto p-4">
                {agentPanelTab === 'logs' ? (
                  // Logs content
                  agentLogs.length === 0 ? (
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
                  )
                ) : (
                  // Blueprint content
                  (() => {
                    const bp = selectedAgent ? getAgentBlueprint(selectedAgent) : undefined
                    return bp ? (
                      <article>
                        <MilkdownViewer key={bp.name} content={bp.content} />
                      </article>
                    ) : (
                      <div className="text-center text-gray-400 py-8">
                        {t('project.noBlueprint')}
                      </div>
                    )
                  })()
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

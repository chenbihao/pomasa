import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, AlertTriangle } from 'lucide-react'
import { getStatusConfig } from '../theme/statusColors'
import { usePageVisibility } from '../hooks/usePageVisibility'
import { useRefreshSettings } from '../stores/useRefreshSettings'
import { fetchProjects } from '../api'
import type { ProjectInfo } from '../types'
import Card from '../components/Card'

interface DashboardPageProps {
  workDir: string
}

export default function DashboardPage({ workDir }: DashboardPageProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isVisible = usePageVisibility()
  const { enabled, interval: refreshInterval } = useRefreshSettings()
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    if (!workDir) {
      setProjects([])
      setLoading(false)
      return
    }

    try {
      const data = await fetchProjects(workDir)
      setProjects(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [workDir])

  useEffect(() => {
    loadProjects()
    if (!isVisible || !enabled) return
    const id = setInterval(loadProjects, refreshInterval)
    return () => clearInterval(id)
  }, [loadProjects, isVisible, enabled, refreshInterval])

  const stats = useMemo(() => ({
    total: projects.length,
    running: projects.filter(p => p.status === 'running').length,
    completed: projects.filter(p => p.status === 'completed').length,
    alerts: projects.filter(p => p.hasAlerts).length,
  }), [projects])

  if (!workDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <LayoutDashboard className="w-16 h-16 mb-4" />
        <p className="text-lg">{t('dashboard.setWorkDir')}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('dashboard.loading')}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="text-sm text-gray-500">{t('dashboard.totalProjects')}</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">{t('dashboard.running')}</div>
          <div className="text-2xl font-semibold text-blue-600">{stats.running}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">{t('dashboard.completed')}</div>
          <div className="text-2xl font-semibold text-green-600">{stats.completed}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">{t('dashboard.withAlerts')}</div>
          <div className="text-2xl font-semibold text-orange-500">{stats.alerts}</div>
        </Card>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4">{error}</div>
      )}

      {/* Project Grid */}
      {projects.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          {t('dashboard.noProjects')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => {
            const hasContent = project.hasObservation || project.status === 'preparing' || project.status === 'ready'
            const statusKey = hasContent ? project.status : 'unknown'
            const config = getStatusConfig(statusKey)
            const Icon = config.icon

            return (
              <Card
                key={project.name}
                className="hover:shadow-md hover:border-blue-300 cursor-pointer transition-all"
                onClick={() => {
                  if (hasContent) {
                    navigate(`/project/${encodeURIComponent(project.name)}`)
                  } else {
                    navigate(`/viewer?path=${encodeURIComponent(project.path)}`)
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 truncate flex-1">{project.name}</h3>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.bg} ${config.color}`}>
                    <Icon className="w-3 h-3" />
                    {hasContent ? t(config.labelKey) : t('dashboard.noObs')}
                    {project.status === 'preparing' && project.prepDetail && <span className="ml-0.5">({project.prepDetail})</span>}
                  </div>
                </div>

                {hasContent && (
                  <>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{project.stagesCompleted} / {project.stages} {t('dashboard.stages')}</span>
                        <span>{Math.round(project.progress * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            project.status === 'completed' ? 'bg-green-500' :
                            project.status === 'failed' ? 'bg-red-500' :
                            project.status === 'preparing' ? 'bg-amber-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${project.progress * 100}%` }}
                        />
                      </div>
                    </div>

                    {project.hasAlerts && (
                      <div className="flex items-center gap-1 text-xs text-orange-500">
                        <AlertTriangle className="w-3 h-3" />
                        {t('dashboard.hasAlerts')}
                      </div>
                    )}

                    {project.lastUpdate && (
                      <div className="text-xs text-gray-400 mt-2">
                        {t('dashboard.lastUpdate')}: {new Date(project.lastUpdate).toLocaleString()}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

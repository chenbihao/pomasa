import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, FolderOpen, Plus, Terminal } from 'lucide-react'

export default function TabNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/viewer', label: t('nav.viewer'), icon: FolderOpen },
    { to: '/create', label: t('nav.create'), icon: Plus },
    { to: '/terminal', label: t('nav.terminal'), icon: Terminal },
  ]

  return (
    <nav className="flex items-center gap-1">
      {tabs.map(tab => {
        const isActive = tab.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(tab.to)
        return (
          <button
            key={tab.to}
            onClick={() => navigate(tab.to)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

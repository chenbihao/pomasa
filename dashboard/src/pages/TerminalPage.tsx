import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  X,
  Search,
  ZoomIn,
  ZoomOut,
  Palette,
} from 'lucide-react'
import Button from '../components/Button'
import TerminalInstance from '../components/TerminalInstance'
import { useTerminalSettings } from '../stores/useTerminalSettings'
import { terminalThemes } from '../theme/terminalThemes'

interface TerminalTab {
  id: string
  title: string
  hasActivity: boolean
}

let tabCounter = 0
function nextTabId() {
  return `term-${++tabCounter}`
}

interface TerminalPageProps {
  workDir: string
}

export default function TerminalPage({ workDir }: TerminalPageProps) {
  const { t, i18n } = useTranslation()
  const { settings, updateTerminalSettings } = useTerminalSettings()
  const [tabs, setTabs] = useState<TerminalTab[]>(() => [
    { id: nextTabId(), title: 'Terminal 1', hasActivity: false },
  ])
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isZh = i18n.language === 'zh'

  const addTab = useCallback(() => {
    const id = nextTabId()
    const newTab: TerminalTab = {
      id,
      title: `Terminal ${tabs.length + 1}`,
      hasActivity: false,
    }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
  }, [tabs.length])

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId)
      if (filtered.length === 0) {
        // Always keep at least one tab
        const id = nextTabId()
        filtered.push({ id, title: 'Terminal 1', hasActivity: false })
        setActiveTabId(id)
      } else if (activeTabId === tabId) {
        setActiveTabId(filtered[filtered.length - 1].id)
      }
      return filtered
    })
  }, [activeTabId])

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, hasActivity: false } : t
    ))
  }, [])

  const handleActivity = useCallback((tabId: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId && t.id !== activeTabId ? { ...t, hasActivity: true } : t
    ))
  }, [activeTabId])

  const handleTitleChange = useCallback((tabId: string, title: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, title } : t
    ))
  }, [])

  const adjustFontSize = useCallback((delta: number) => {
    const newSize = Math.max(10, Math.min(32, settings.fontSize + delta))
    updateTerminalSettings({ fontSize: newSize })
  }, [settings.fontSize, updateTerminalSettings])

  const toggleSearch = useCallback(() => {
    setShowSearch(prev => {
      const next = !prev
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      return next
    })
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSearch(false)
      setSearchQuery('')
    } else if (e.key === 'Enter') {
      // Search is triggered by the query state change
    }
  }, [])

  // Global keyboard shortcut for search
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault()
      toggleSearch()
    }
  }, [toggleSearch])

  // Register global keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  const headerActions = (
    <div className="flex items-center gap-1">
      {/* Search */}
      {showSearch && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('terminal.search')}
            className="bg-transparent text-sm w-32 outline-none placeholder:text-gray-400"
          />
          <button
            onClick={() => { setShowSearch(false); setSearchQuery('') }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Font size */}
      <Button variant="ghost" size="icon" onClick={() => adjustFontSize(-1)} title={t('terminal.zoomOut')}>
        <ZoomOut className="w-4 h-4" />
      </Button>
      <span className="text-xs text-gray-500 min-w-[2rem] text-center">{settings.fontSize}px</span>
      <Button variant="ghost" size="icon" onClick={() => adjustFontSize(1)} title={t('terminal.zoomIn')}>
        <ZoomIn className="w-4 h-4" />
      </Button>

      {/* Theme */}
      <div className="relative">
        <Button variant="ghost" size="icon" onClick={() => setShowThemeMenu(!showThemeMenu)} title={t('terminal.theme')}>
          <Palette className="w-4 h-4" />
        </Button>
        {showThemeMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[160px]">
              {terminalThemes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => {
                    updateTerminalSettings({ themeId: theme.id })
                    setShowThemeMenu(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50 ${
                    settings.themeId === theme.id ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border"
                    style={{ background: theme.cssBackground }}
                  />
                  {isZh ? theme.labelZh : theme.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Search toggle */}
      <Button variant="ghost" size="icon" onClick={toggleSearch} title={t('terminal.search')}>
        <Search className="w-4 h-4" />
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="bg-white border-b flex items-center px-2 shrink-0">
        <div className="flex items-center gap-0.5 overflow-x-auto py-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-lg transition-colors whitespace-nowrap ${
                tab.id === activeTabId
                  ? 'bg-[#1e1e1e] text-gray-200'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.hasActivity && tab.id !== activeTabId && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <span
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  className="ml-1 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={addTab}
          className="p-1 ml-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title={t('terminal.newTab')}
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {headerActions}
        </div>
      </div>

      {/* Terminal instances */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.id === activeTabId ? '' : 'hidden'}`}
          >
            <TerminalInstance
              workDir={workDir}
              active={tab.id === activeTabId}
              onTitleChange={title => handleTitleChange(tab.id, title)}
              onActivity={() => handleActivity(tab.id)}
              searchQuery={tab.id === activeTabId ? searchQuery : ''}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronsDown, ChevronsUp, Locate, Search, X, ChevronRight, FolderOpen, RefreshCw, FileText, AlertCircle } from 'lucide-react'
import MilkdownViewer from '../components/MilkdownViewer'
import Button from '../components/Button'
import { FileTreeItem, collectDirPaths, findPathToFile } from '../components/FileTree'
import { fetchFileTree, fetchFileContent, fetchDirFingerprints, fetchFileStat } from '../api'
import { usePageVisibility } from '../hooks/usePageVisibility'
import type { FileNode } from '../types'

interface ViewerPageProps {
  workDir: string
}

interface OpenTab {
  path: string
  name: string
  content: string
  loading: boolean
  mtimeMs: number | null
  imageError: boolean
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico']

const QUICK_NAV_DIRS = ['agents', 'references', 'workspace', 'wip', 'scripts', 'library', 'wiki', '_output', '_observation']

/** Normalize path separators to forward slashes for consistent comparison */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function getImageExt(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTS.includes(ext) ? ext : null
}

function normalizeDisplayPath(filePath: string, rootPath: string): string {
  const nr = normalizePath(rootPath).replace(/\/$/, '')
  const nf = normalizePath(filePath)
  if (nf.startsWith(nr + '/')) return nf.slice(nr.length + 1)
  return nf
}

function buildBreadcrumbs(filePath: string, rootPath: string): { label: string; path: string }[] {
  const relative = normalizeDisplayPath(filePath, rootPath)
  const segments = relative.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = []
  let accumulated = normalizePath(rootPath).replace(/\/$/, '')
  for (const seg of segments) {
    accumulated += '/' + seg
    crumbs.push({ label: seg, path: accumulated })
  }
  return crumbs
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query) return nodes
  const lower = query.toLowerCase()
  const result: FileNode[] = []
  for (const node of nodes) {
    if (node.type === 'directory' && node.children) {
      const filteredChildren = filterTree(node.children, query)
      if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lower)) {
        result.push({ ...node, children: filteredChildren })
      }
    } else if (node.name.toLowerCase().includes(lower)) {
      result.push(node)
    }
  }
  return result
}

function fingerprintsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (a[key] !== b[key]) return false
  }
  return true
}

export default function ViewerPage({ workDir }: ViewerPageProps) {
  const [searchParams] = useSearchParams()
  const pathParam = searchParams.get('path')
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isVisible = usePageVisibility()

  const [tree, setTree] = useState<FileNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const isDragging = useRef(false)

  // Multi-tab state
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabIndex, setActiveTabIndex] = useState(-1)

  // Refs for stable access inside intervals
  const openTabsRef = useRef(openTabs)
  const activeTabIndexRef = useRef(activeTabIndex)
  useEffect(() => { openTabsRef.current = openTabs }, [openTabs])
  useEffect(() => { activeTabIndexRef.current = activeTabIndex }, [activeTabIndex])

  // File change detection
  const [treeChanged, setTreeChanged] = useState(false)
  const lastFingerprintsRef = useRef<Record<string, number>>({})
  const normalizedWorkDir = normalizePath(workDir)
  const normalizedPathParam = pathParam ? normalizePath(pathParam) : null
  const isRootLevel = normalizedPathParam === null || normalizedPathParam === normalizedWorkDir

  const rootPath = pathParam || workDir

  // --- Tree loading ---
  const loadTree = useCallback(async (dirPath: string) => {
    try {
      const treeData = await fetchFileTree(dirPath)
      setTree(treeData)
      const rootDirs = new Set<string>()
      treeData.forEach((node: FileNode) => {
        if (node.type === 'directory') rootDirs.add(node.path)
      })
      setExpandedPaths(rootDirs)
      setTreeChanged(false)
      const fp = await fetchDirFingerprints(dirPath)
      lastFingerprintsRef.current = fp
    } catch (err) {
      console.error('Failed to load tree:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (rootPath) loadTree(rootPath)
    else setLoading(false)
  }, [rootPath, loadTree])

  // Auto-select file from pathParam
  useEffect(() => {
    if (!pathParam || tree.length === 0) return
    const normalizedParam = normalizePath(pathParam)
    const isDir = tree.some(n => n.type === 'directory' && normalizePath(n.path) === normalizedParam)
    if (!isDir) {
      const ancestors = findPathToFile(tree, pathParam)
      if (ancestors) {
        setExpandedPaths(prev => {
          const next = new Set(prev)
          ancestors.forEach(p => next.add(p))
          return next
        })
        openFileInTab(pathParam)
      }
    }
  }, [pathParam, tree]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- File change polling ---
  useEffect(() => {
    if (!isVisible || !rootPath) return
    const interval = setInterval(async () => {
      const fp = await fetchDirFingerprints(rootPath)
      if (Object.keys(fp).length > 0 && !fingerprintsEqual(fp, lastFingerprintsRef.current)) {
        setTreeChanged(true)
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [isVisible, rootPath])

  // Poll active tab file for content changes
  useEffect(() => {
    if (!isVisible) return
    const interval = setInterval(async () => {
      const tabs = openTabsRef.current
      const idx = activeTabIndexRef.current
      const tab = tabs[idx]
      if (!tab || tab.loading) return

      const stat = await fetchFileStat(tab.path)
      if (stat && tab.mtimeMs && stat.mtimeMs !== tab.mtimeMs) {
        const content = await fetchFileContent(tab.path)
        setOpenTabs(prev => prev.map((t, i) =>
          i === idx ? { ...t, content, mtimeMs: stat.mtimeMs } : t
        ))
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [isVisible])

  // --- Multi-tab ---
  const openFileInTab = useCallback(async (filePath: string) => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath

    // Use functional updater to avoid stale closure on openTabs
    let isNew = false
    let newIndex = 0
    setOpenTabs(prev => {
      const existingIndex = prev.findIndex(t => normalizePath(t.path) === normalizePath(filePath))
      if (existingIndex >= 0) {
        setActiveTabIndex(existingIndex)
        return prev
      }
      isNew = true
      newIndex = prev.length
      setActiveTabIndex(newIndex)
      return [...prev, { path: filePath, name: fileName, content: '', loading: true, mtimeMs: null, imageError: false }]
    })

    if (!isNew) return

    // Load content
    try {
      const [content, stat] = await Promise.all([
        fetchFileContent(filePath),
        fetchFileStat(filePath),
      ])
      setOpenTabs(prev => prev.map((t, i) =>
        i === newIndex ? { ...t, content, loading: false, mtimeMs: stat?.mtimeMs ?? null } : t
      ))
    } catch (err) {
      setOpenTabs(prev => prev.map((t, i) =>
        i === newIndex ? { ...t, content: `Error: ${err instanceof Error ? err.message : String(err)}`, loading: false } : t
      ))
    }
  }, [])

  const closeTab = useCallback((index: number) => {
    setOpenTabs(prev => {
      const next = prev.filter((_, i) => i !== index)
      // Compute new active index
      const currentActive = activeTabIndexRef.current
      if (next.length === 0) {
        setActiveTabIndex(-1)
      } else if (currentActive >= next.length) {
        setActiveTabIndex(next.length - 1)
      } else if (index < currentActive) {
        setActiveTabIndex(currentActive - 1)
      } else if (index === currentActive && currentActive >= next.length) {
        setActiveTabIndex(next.length - 1)
      }
      return next
    })
  }, [])

  // Tab context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabIndex: number } | null>(null)

  const handleTabContextMenu = (e: React.MouseEvent, tabIndex: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabIndex })
  }

  const closeAllTabs = useCallback(() => {
    setOpenTabs([])
    setActiveTabIndex(-1)
    setContextMenu(null)
  }, [])

  const closeRightTabs = useCallback((index: number) => {
    setOpenTabs(prev => {
      const next = prev.slice(0, index + 1)
      if (activeTabIndexRef.current > index) setActiveTabIndex(index)
      return next
    })
    setContextMenu(null)
  }, [])

  const closeOtherTabs = useCallback((index: number) => {
    setOpenTabs(prev => prev.length > 0 ? [prev[index]] : [])
    setActiveTabIndex(0)
    setContextMenu(null)
  }, [])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const activeTab = activeTabIndex >= 0 && activeTabIndex < openTabs.length ? openTabs[activeTabIndex] : null

  // --- Tree interactions ---
  const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery])

  useEffect(() => {
    if (searchQuery) {
      setExpandedPaths(new Set(collectDirPaths(filteredTree)))
    }
  }, [searchQuery, filteredTree])

  const handleToggle = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleSelect = (filePath: string) => {
    openFileInTab(filePath)
  }

  const handleExpandAll = useCallback(() => {
    setExpandedPaths(new Set(collectDirPaths(tree)))
  }, [tree])

  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set())
  }, [])

  const handleLocate = useCallback(() => {
    if (!activeTab) return
    const pathToFile = findPathToFile(tree, activeTab.path)
    if (pathToFile) {
      setExpandedPaths(prev => {
        const next = new Set(prev)
        pathToFile.forEach(p => next.add(p))
        return next
      })
    }
  }, [tree, activeTab])

  const handleRefreshTree = useCallback(() => {
    loadTree(rootPath)
  }, [loadTree, rootPath])

  // Focus on a directory in the tree: clear search, expand only its ancestors
  const focusDirectoryInTree = useCallback((dirPath: string) => {
    setSearchQuery('')
    const ancestors = findPathToFile(tree, dirPath)
    if (ancestors) {
      setExpandedPaths(new Set(ancestors))
    } else {
      const rootDirs = new Set<string>()
      tree.forEach(node => { if (node.type === 'directory') rootDirs.add(node.path) })
      setExpandedPaths(rootDirs)
    }
  }, [tree])

  // Draggable sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      setSidebarWidth(Math.min(Math.max(ev.clientX, 200), 600))
    }
    const onUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // --- Quick navigation ---
  const [quickNavDirs, setQuickNavDirs] = useState<{ name: string; path: string }[]>([])

  useEffect(() => {
    if (!isRootLevel || !workDir) return
    const checkDirs = async () => {
      const results: { name: string; path: string }[] = []
      for (const dir of QUICK_NAV_DIRS) {
        const dirPath = normalizePath(workDir) + '/' + dir
        try {
          const stat = await fetchFileStat(dirPath)
          if (stat) results.push({ name: dir, path: dirPath })
        } catch { /* doesn't exist */ }
      }
      setQuickNavDirs(results)
    }
    checkDirs()
  }, [isRootLevel, workDir])

  // --- Render ---
  if (!rootPath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('viewer.setWorkDir')}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        {t('viewer.loading')}
      </div>
    )
  }

  const isMarkdown = activeTab?.path.endsWith('.md')
  const isImage = activeTab ? getImageExt(activeTab.path) !== null : false
  const breadcrumbs = activeTab ? buildBreadcrumbs(activeTab.path, rootPath) : []
  const rootDisplayName = normalizePath(rootPath).split('/').filter(Boolean).pop() || '/'

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside
        className="border-r bg-white flex flex-col shrink-0"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-gray-50">
          <Button variant="ghost" size="icon" onClick={handleExpandAll} title={t('viewer.expandAll')}>
            <ChevronsDown className="w-4 h-4 text-gray-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCollapseAll} title={t('viewer.collapseAll')}>
            <ChevronsUp className="w-4 h-4 text-gray-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLocate} disabled={!activeTab} title={t('viewer.locateFile')}>
            <Locate className="w-4 h-4 text-gray-600" />
          </Button>
          {treeChanged && (
            <Button variant="ghost" size="icon" onClick={handleRefreshTree} title={t('viewer.refresh')}>
              <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="px-2 py-1.5 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('viewer.searchPlaceholder')}
              className="w-full pl-7 pr-7 py-1 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick navigation (root level only) */}
        {isRootLevel && quickNavDirs.length > 0 && !searchQuery && (
          <div className="px-2 py-2 border-b bg-blue-50/50">
            <div className="text-xs font-medium text-gray-500 mb-1.5 px-1">{t('viewer.quickNav')}</div>
            <div className="flex flex-wrap gap-1">
              {quickNavDirs.map(dir => (
                <button
                  key={dir.name}
                  onClick={() => navigate(`/viewer?path=${encodeURIComponent(dir.path)}`)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <FolderOpen className="w-3 h-3 text-blue-500" />
                  {dir.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {filteredTree.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">
              {searchQuery ? t('viewer.noMatch') : t('viewer.selectFile')}
            </div>
          ) : (
            filteredTree.map(node => (
              <FileTreeItem
                key={node.path}
                node={node}
                depth={0}
                onSelect={handleSelect}
                selectedPath={activeTab?.path ?? null}
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      </aside>

      {/* Resize handle */}
      <div
        className="w-1 hover:w-1.5 bg-transparent hover:bg-blue-400 cursor-col-resize transition-all shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Content area */}
      <main className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
        {/* Tab bar */}
        {openTabs.length > 0 && (
          <div className="flex items-center border-b bg-gray-50 shrink-0 overflow-x-auto">
            {openTabs.map((tab, i) => (
              <div
                key={`${tab.path}-${i}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-r cursor-pointer whitespace-nowrap shrink-0 max-w-[180px] ${
                  i === activeTabIndex
                    ? 'bg-white text-gray-800 border-b-2 border-b-blue-500'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                onClick={() => setActiveTabIndex(i)}
                onContextMenu={e => handleTabContextMenu(e, i)}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); closeTab(i) }}
                  className="ml-1 text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 text-sm min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
              onClick={() => closeOtherTabs(contextMenu.tabIndex)}
            >
              {t('viewer.closeOthers')}
            </button>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-gray-700"
              onClick={() => closeRightTabs(contextMenu.tabIndex)}
            >
              {t('viewer.closeRight')}
            </button>
            <div className="border-t my-1" />
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-red-600"
              onClick={closeAllTabs}
            >
              {t('viewer.closeAll')}
            </button>
          </div>
        )}

        {/* File content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab ? (
            <div className="p-6">
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-1 mb-4 pb-2 border-b text-sm overflow-x-auto">
                <button
                  className="text-gray-400 hover:text-blue-600 shrink-0"
                  onClick={() => focusDirectoryInTree(rootPath)}
                >
                  {rootDisplayName}
                </button>
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.path} className="flex items-center gap-1 shrink-0">
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                    {i < breadcrumbs.length - 1 ? (
                      <button
                        className="text-gray-500 hover:text-blue-600 hover:underline truncate max-w-[300px]"
                        title={crumb.label}
                        onClick={() => focusDirectoryInTree(crumb.path)}
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span className="text-gray-700 font-medium truncate max-w-[400px]" title={crumb.label}>
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>

              {/* Content */}
              {activeTab.loading ? (
                <div className="text-center text-gray-400 py-20">{t('viewer.loading')}</div>
              ) : isImage ? (
                <div className="flex flex-col items-center justify-center p-4 gap-3">
                  {activeTab.imageError ? (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <AlertCircle className="w-8 h-8" />
                      <span className="text-sm">{t('viewer.imageLoadError')}</span>
                    </div>
                  ) : (
                    <img
                      src={`/api/fs/file?path=${encodeURIComponent(activeTab.path)}`}
                      alt={activeTab.name}
                      className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-sm"
                      onError={() => {
                        setOpenTabs(prev => prev.map((t, i) =>
                          i === activeTabIndex ? { ...t, imageError: true } : t
                        ))
                      }}
                    />
                  )}
                </div>
              ) : isMarkdown ? (
                <article>
                  <MilkdownViewer key={activeTab.path} content={activeTab.content} />
                </article>
              ) : (
                <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto">
                  {activeTab.content}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-gray-400 text-center mt-20">
              {t('viewer.selectFile')}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Folder, ChevronRight, ChevronDown, File, FileCode, FileImage, ChevronsDown, ChevronsUp, Locate } from 'lucide-react'
import MilkdownViewer from '../components/MilkdownViewer'
import Button from '../components/Button'
import { fetchFileTree, fetchFileContent } from '../api'
import type { FileNode } from '../types'

interface ViewerPageProps {
  workDir: string
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext ?? '')) return FileImage
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'sh', 'bash'].includes(ext ?? '')) return FileCode
  return File
}

function renderFileIcon(type: string, name: string) {
  if (type === 'directory') {
    return <Folder className="w-4 h-4 mr-2 shrink-0 text-yellow-500" />
  }
  const IconComponent = getFileIcon(name)
  return <IconComponent className="w-4 h-4 mr-2 shrink-0 text-gray-400" />
}

function FileTreeItem({
  node,
  depth,
  onSelect,
  selectedPath,
  expandedPaths,
  onToggle
}: {
  node: FileNode
  depth: number
  onSelect: (path: string) => void
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggle: (path: string) => void
}) {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path

  return (
    <>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 ${
          isSelected ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (node.type === 'directory') onToggle(node.path)
          else onSelect(node.path)
        }}
      >
        {node.type === 'directory' ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 mr-1 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 mr-1 shrink-0" />
          )
        ) : (
          <span className="w-4 mr-1 shrink-0" />
        )}
        {renderFileIcon(node.type, node.name)}
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  )
}

function collectDirPaths(nodes: FileNode[]): string[] {
  const paths: string[] = []
  function walk(items: FileNode[]) {
    for (const item of items) {
      if (item.type === 'directory') {
        paths.push(item.path)
        if (item.children) walk(item.children)
      }
    }
  }
  walk(nodes)
  return paths
}

function findPathToFile(nodes: FileNode[], targetPath: string, currentPath: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.path === targetPath) return [...currentPath, node.path]
    if (node.type === 'directory' && node.children) {
      const found = findPathToFile(node.children, targetPath, [...currentPath, node.path])
      if (found) return found
    }
  }
  return null
}

/** Normalize path separators for cross-platform display */
function normalizeDisplayPath(filePath: string, rootPath: string): string {
  const normalizedRoot = rootPath.replace(/[/\\]$/, '')
  if (filePath.startsWith(normalizedRoot + '/') || filePath.startsWith(normalizedRoot + '\\')) {
    return filePath.slice(normalizedRoot.length + 1)
  }
  return filePath
}

export default function ViewerPage({ workDir }: ViewerPageProps) {
  const [searchParams] = useSearchParams()
  const pathParam = searchParams.get('path')
  const { t } = useTranslation()

  const [tree, setTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const rootPath = pathParam || workDir

  const loadTree = useCallback(async (dirPath: string) => {
    try {
      const treeData = await fetchFileTree(dirPath)
      setTree(treeData)

      const rootDirs = new Set<string>()
      treeData.forEach((node: FileNode) => {
        if (node.type === 'directory') rootDirs.add(node.path)
      })
      setExpandedPaths(rootDirs)
    } catch (err) {
      console.error('Failed to load tree:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFileContent = useCallback(async (filePath: string) => {
    try {
      const content = await fetchFileContent(filePath)
      setFileContent(content)
    } catch (err) {
      setFileContent(`Error: ${err}`)
    }
  }, [])

  useEffect(() => {
    if (rootPath) loadTree(rootPath)
    else setLoading(false)
  }, [rootPath, loadTree])

  useEffect(() => {
    if (selectedFile) loadFileContent(selectedFile)
    else setFileContent('')
  }, [selectedFile, loadFileContent])

  const handleToggle = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleExpandAll = useCallback(() => {
    setExpandedPaths(new Set(collectDirPaths(tree)))
  }, [tree])

  const handleCollapseAll = useCallback(() => {
    const rootDirs = new Set<string>()
    tree.forEach(node => { if (node.type === 'directory') rootDirs.add(node.path) })
    setExpandedPaths(rootDirs)
  }, [tree])

  const handleLocate = useCallback(() => {
    if (!selectedFile) return
    const pathToFile = findPathToFile(tree, selectedFile)
    if (pathToFile) {
      setExpandedPaths(prev => {
        const next = new Set(prev)
        pathToFile.forEach(p => next.add(p))
        return next
      })
    }
  }, [tree, selectedFile])

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

  const isMarkdown = selectedFile?.endsWith('.md')

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-80 border-r bg-white flex flex-col shrink-0">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-gray-50">
          <Button variant="ghost" size="icon" onClick={handleExpandAll} title={t('viewer.expandAll')}>
            <ChevronsDown className="w-4 h-4 text-gray-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCollapseAll} title={t('viewer.collapseAll')}>
            <ChevronsUp className="w-4 h-4 text-gray-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLocate} disabled={!selectedFile} title={t('viewer.locateFile')}>
            <Locate className="w-4 h-4 text-gray-600" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {tree.map(node => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              onSelect={setSelectedFile}
              selectedPath={selectedFile}
              expandedPaths={expandedPaths}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-white">
        {selectedFile ? (
          <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-sm text-gray-500 mb-4 font-mono pb-2 border-b">
              {normalizeDisplayPath(selectedFile, rootPath)}
            </h2>
            {isMarkdown ? (
              <article>
                <MilkdownViewer key={selectedFile} content={fileContent} />
              </article>
            ) : (
              <pre className="text-sm font-mono whitespace-pre-wrap bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto">
                {fileContent}
              </pre>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-center mt-20">
            {t('viewer.selectFile')}
          </div>
        )}
      </main>
    </div>
  )
}

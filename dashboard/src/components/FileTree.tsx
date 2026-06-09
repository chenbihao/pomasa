/* eslint-disable react-refresh/only-export-components */
import { Folder, ChevronRight, ChevronDown, File, FileCode, FileImage } from 'lucide-react'
import type { FileNode } from '../types'

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext ?? '')) return FileImage
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'sh', 'bash'].includes(ext ?? '')) return FileCode
  return File
}

export function renderFileIcon(type: string, name: string) {
  if (type === 'directory') {
    return <Folder className="w-4 h-4 mr-2 shrink-0 text-yellow-500" />
  }
  const IconComponent = getFileIcon(name)
  return <IconComponent className="w-4 h-4 mr-2 shrink-0 text-gray-400" />
}

export function FileTreeItem({
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

export function collectDirPaths(nodes: FileNode[]): string[] {
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

export function findPathToFile(nodes: FileNode[], targetPath: string, currentPath: string[] = []): string[] | null {
  const normalizedTarget = targetPath.replace(/\\/g, '/')
  for (const node of nodes) {
    if (node.path.replace(/\\/g, '/') === normalizedTarget) return [...currentPath, node.path]
    if (node.type === 'directory' && node.children) {
      const found = findPathToFile(node.children, targetPath, [...currentPath, node.path])
      if (found) return found
    }
  }
  return null
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Check, X } from 'lucide-react'
import { useWorkDir } from '../stores/useWorkDir'
import Button from './Button'

export default function WorkDirSelector() {
  const { workDir, setWorkDir } = useWorkDir()
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState(workDir)
  const { t } = useTranslation()

  const handleSave = () => {
    if (tempValue.trim()) setWorkDir(tempValue.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setTempValue(workDir)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={tempValue}
          onChange={e => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="px-2 py-1 text-sm border border-blue-400 rounded-lg w-64 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button variant="ghost" size="icon" onClick={handleSave} title={t('common.save')}>
          <Check className="w-4 h-4 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCancel} title={t('common.cancel')}>
          <X className="w-4 h-4 text-red-600" />
        </Button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setTempValue(workDir); setEditing(true) }}
      className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      title={t('workDir.change')}
    >
      <FolderOpen className="w-4 h-4" />
      <span className="truncate max-w-xs">{workDir || t('workDir.notSet')}</span>
    </button>
  )
}

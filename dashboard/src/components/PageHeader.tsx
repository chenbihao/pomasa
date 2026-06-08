import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  /** Show back button; callback fired on click */
  onBack?: () => void
  /** Main title */
  title: string
  /** Optional subtitle / description line */
  subtitle?: string
  /** Right-side actions (buttons, badges, etc.) */
  actions?: ReactNode
}

/**
 * Unified page header bar.
 * Consistent padding (px-4 py-3), white background, bottom border.
 */
export default function PageHeader({ onBack, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="bg-white border-b px-4 py-3 flex items-center gap-4 shrink-0">
      {onBack && (
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
      {actions && (
        <>
          <div className="flex-1" />
          <div className="flex items-center gap-3 shrink-0">
            {actions}
          </div>
        </>
      )}
    </header>
  )
}

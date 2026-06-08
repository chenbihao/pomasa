import { useTranslation } from 'react-i18next'
import { getStatusConfig } from '../theme/statusColors'

interface StatusBadgeProps {
  state: string
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export default function StatusBadge({ state, size = 'sm', showIcon = true }: StatusBadgeProps) {
  const { t } = useTranslation()
  const config = getStatusConfig(state)
  const Icon = config.icon
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bg} ${config.color} ${sizeClass}`}>
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
      {t(config.labelKey)}
    </span>
  )
}

// Animated pulse for running state
export function RunningPulse() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
    </span>
  )
}

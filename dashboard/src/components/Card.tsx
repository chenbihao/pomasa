import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Remove default padding */
  noPadding?: boolean
}

/**
 * Unified card container.
 * Default: bg-white rounded-xl shadow-sm border p-5
 */
export default function Card({ children, noPadding, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border ${noPadding ? '' : 'p-5'} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

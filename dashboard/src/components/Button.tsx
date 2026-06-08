import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost'
type ButtonSize = 'md' | 'sm' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary:
    'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50',
  success:
    'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300',
  ghost:
    'text-gray-600 hover:bg-gray-100 disabled:opacity-50',
}

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-sm font-medium rounded-lg',
  sm: 'px-3 py-1.5 text-sm rounded-md',
  icon: 'p-2 rounded-lg',
}

/**
 * Unified button component with consistent styling across the app.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

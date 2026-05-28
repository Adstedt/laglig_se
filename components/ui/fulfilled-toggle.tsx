'use client'

import * as React from 'react'
import { Check, Circle } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface FulfilledToggleProps {
  checked: boolean
  onCheckedChange?: (_next: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export const FulfilledToggle = React.forwardRef<
  HTMLButtonElement,
  FulfilledToggleProps
>(({ checked, onCheckedChange, disabled, className, ...props }, ref) => {
  const Icon = checked ? Check : Circle
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
        'ring-offset-background transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        checked
          ? 'text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
    >
      <Icon
        className="h-4 w-4"
        strokeWidth={checked ? 2.5 : 1.75}
        aria-hidden="true"
      />
    </button>
  )
})
FulfilledToggle.displayName = 'FulfilledToggle'

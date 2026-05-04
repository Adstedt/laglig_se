import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ColorTagBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  name: string
  color: string
  size?: 'sm' | 'md' | undefined
  showDot?: boolean | undefined
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-[10.5px]',
  md: 'px-2.5 py-0.5 text-xs',
} as const

const ColorTagBadge = React.forwardRef<HTMLSpanElement, ColorTagBadgeProps>(
  function ColorTagBadge(
    { name, color, size = 'md', showDot = true, className, ...rest },
    ref
  ) {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
          SIZE_CLASSES[size],
          className
        )}
        style={{
          backgroundColor: `${color}24`,
          borderColor: `${color}59`,
          color,
        }}
        {...rest}
      >
        {showDot ? (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        ) : null}
        {name}
      </span>
    )
  }
)

export { ColorTagBadge }

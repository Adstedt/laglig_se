import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> {
  icon?: React.ReactNode
  title?: string | undefined
  description?: string | undefined
  action?: React.ReactNode
}

interface EmptyStateComponent extends React.ForwardRefExoticComponent<
  EmptyStateProps & React.RefAttributes<HTMLDivElement>
> {
  Icon: typeof EmptyStateIcon
}

const EmptyStateImpl = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(
    { icon, title, description, action, className, ...rest },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center gap-4 py-12 text-center',
          className
        )}
        {...rest}
      >
        {icon}
        {title || description ? (
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-medium">{title}</h2> : null}
            {description ? (
              <p className="text-sm text-muted-foreground max-w-md">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}
        {action}
      </div>
    )
  }
)

function EmptyStateIcon({ children }: { children: React.ReactNode }) {
  return <div className="rounded-full bg-muted p-4">{children}</div>
}

const EmptyState = EmptyStateImpl as EmptyStateComponent
EmptyState.Icon = EmptyStateIcon

export { EmptyState }

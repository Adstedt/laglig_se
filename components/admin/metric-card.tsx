import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: number | string
  description?: string | undefined
  children?: React.ReactNode | undefined
  /** Optional Tailwind classes applied to the large value number — e.g.
   *  `text-rose-600` for warning-red SLA-breach metrics (Story 24.5 AC 15). */
  valueClassName?: string | undefined
}

export function MetricCard({
  title,
  value,
  description,
  children,
  valueClassName,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-3xl font-bold', valueClassName)}>{value}</div>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
        {children ? <div className="mt-3 space-y-1">{children}</div> : null}
      </CardContent>
    </Card>
  )
}

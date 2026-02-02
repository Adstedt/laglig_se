import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MetricCardProps {
  title: string
  value: number | string
  description?: string | undefined
  children?: React.ReactNode | undefined
}

export function MetricCard({
  title,
  value,
  description,
  children,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
        {children ? <div className="mt-3 space-y-1">{children}</div> : null}
      </CardContent>
    </Card>
  )
}

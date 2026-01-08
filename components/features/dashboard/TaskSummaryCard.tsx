import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type LucideIcon } from 'lucide-react'

interface TaskSummaryCardProps {
  title: string
  count: number
  description?: string
  icon: LucideIcon
  accentColor: string
  href?: string
}

export function TaskSummaryCard({
  title,
  count,
  description,
  icon: Icon,
  accentColor,
  href,
}: TaskSummaryCardProps) {
  const content = (
    <Card className="transition-colors hover:bg-accent/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4" style={{ color: accentColor }} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={{ color: accentColor }}>
          {count}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

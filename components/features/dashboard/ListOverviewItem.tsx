import Link from 'next/link'

interface ListOverviewItemProps {
  id: string
  name: string
  compliantCount: number
  totalCount: number
}

export function ListOverviewItem({
  id,
  name,
  compliantCount,
  totalCount,
}: ListOverviewItemProps) {
  const percentage =
    totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0

  return (
    <Link
      href={`/lists/${id}`}
      className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-accent transition-colors"
    >
      <span className="text-sm font-medium truncate flex-shrink-0 w-1/3">
        {name}
      </span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground w-12 text-right">
        {percentage}%
      </span>
    </Link>
  )
}

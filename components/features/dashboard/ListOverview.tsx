import Link from 'next/link'
import { FolderOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListOverviewItem } from './ListOverviewItem'

interface ListData {
  id: string
  name: string
  compliantCount: number
  totalCount: number
}

interface ListOverviewProps {
  lists: ListData[]
}

export function ListOverview({ lists }: ListOverviewProps) {
  // Show empty state if no lists
  if (lists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mina listor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <FolderOpen className="h-8 w-8 mb-2" />
          <p className="text-center font-medium">Inga listor att visa</p>
          <p className="text-center text-sm mt-1">
            Dina senaste listor visas här
          </p>
          <Button asChild className="mt-4">
            <Link href="/lists">Utforska listor</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Mina listor</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/lists">Visa alla</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {lists.map((list) => (
            <ListOverviewItem
              key={list.id}
              id={list.id}
              name={list.name}
              compliantCount={list.compliantCount}
              totalCount={list.totalCount}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

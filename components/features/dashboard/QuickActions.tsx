import Link from 'next/link'
import { MessageSquare, Plus, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Snabbåtgärder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Button variant="outline" asChild className="flex-1">
            <Link href="/ai-chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Fråga AI
            </Link>
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <Link href="/lists">
              <Plus className="mr-2 h-4 w-4" />
              Lägg till lag
            </Link>
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <Link href="/settings?tab=team">
              <UserPlus className="mr-2 h-4 w-4" />
              Bjud in teammedlem
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

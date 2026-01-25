'use client'

/**
 * Story 6.6: Linked Laws Box
 * Display and manage linked legal documents
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Scale, Plus, X, ExternalLink, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { unlinkListItemFromTask } from '@/app/actions/task-modal'
import { toast } from 'sonner'

interface LinkedLaw {
  id: string
  law_list_item: {
    id: string
    document: {
      id: string
      title: string
      document_number: string
      slug: string
    }
  }
}

interface LinkedLawsBoxProps {
  taskId: string
  links: LinkedLaw[]
  onUpdate: () => Promise<void>
}

export function LinkedLawsBox({ taskId, links, onUpdate }: LinkedLawsBoxProps) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)

  const handleUnlink = async (listItemId: string) => {
    const result = await unlinkListItemFromTask(taskId, listItemId)
    if (result.success) {
      await onUpdate()
    } else {
      toast.error('Kunde inte ta bort länk', { description: result.error })
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Länkade lagar
          </CardTitle>
          <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Länka lag till uppgift</DialogTitle>
              </DialogHeader>
              <LawSearchDialog
                taskId={taskId}
                existingLinks={links.map((l) => l.law_list_item.id)}
                onLink={async () => {
                  await onUpdate()
                  setSearchDialogOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Scale className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Inga länkade lagar</p>
            <Button
              variant="link"
              size="sm"
              className="text-xs mt-1"
              onClick={() => setSearchDialogOpen(true)}
            >
              + Lägg till länk
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className={cn(
                  'flex items-start justify-between gap-2 p-2 rounded-md',
                  'bg-muted/50 hover:bg-muted transition-colors group'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {link.law_list_item.document.document_number}
                    </Badge>
                    <a
                      href={`/browse/lagar/${link.law_list_item.document.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>
                  <p className="text-sm truncate mt-1">
                    {link.law_list_item.document.title}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleUnlink(link.law_list_item.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface LawSearchDialogProps {
  taskId: string
  existingLinks: string[]
  onLink: () => Promise<void>
}

function LawSearchDialog({
  taskId,
  existingLinks,
  onLink,
}: LawSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<
    Array<{
      id: string
      document: { title: string; document_number: string }
    }>
  >([])
  const [isLinking, setIsLinking] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    // TODO: Implement search endpoint
    // For now, show placeholder
    setResults([])
    setIsSearching(false)
  }

  const handleLink = async (listItemId: string) => {
    setIsLinking(listItemId)

    const { linkListItemToTask } = await import('@/app/actions/task-modal')
    const result = await linkListItemToTask(taskId, listItemId)

    if (result.success) {
      await onLink()
    } else {
      toast.error('Kunde inte länka', { description: result.error })
    }

    setIsLinking(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Sök efter lag..."
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sök'}
        </Button>
      </div>

      <ScrollArea className="h-[300px]">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Scale className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? 'Inga lagar hittades'
                : 'Sök efter lagar i din laglista'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((item) => {
              const isLinked = existingLinks.includes(item.id)
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-md border"
                >
                  <div className="min-w-0">
                    <Badge variant="outline" className="text-xs mb-1">
                      {item.document.document_number}
                    </Badge>
                    <p className="text-sm truncate">{item.document.title}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isLinked ? 'secondary' : 'default'}
                    disabled={isLinked || isLinking === item.id}
                    onClick={() => handleLink(item.id)}
                  >
                    {isLinking === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isLinked ? (
                      'Länkad'
                    ) : (
                      'Länka'
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

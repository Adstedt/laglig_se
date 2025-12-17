'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar as CalendarIcon,
  History,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { sv } from 'date-fns/locale'

interface Amendment {
  sfsNumber: string
  effectiveDate: string // YYYY-MM-DD
  sectionsChanged: number
}

interface VersionSelectorProps {
  lawSlug: string
  lawSfs: string // e.g., "1977:1160"
  currentDate?: string // If viewing a historical version
  className?: string
}

export function VersionSelector({
  lawSlug,
  lawSfs,
  currentDate,
  className,
}: VersionSelectorProps) {
  const router = useRouter()
  const [amendments, setAmendments] = useState<Amendment[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)

  // Fetch amendment history
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/laws/${encodeURIComponent(lawSfs)}/history`
        )
        if (res.ok) {
          const data = await res.json()
          // Filter out amendments without effectiveDate and normalize date format
          const validAmendments = (data.amendments || [])
            .filter(
              (a: Amendment & { effectiveDate: string | null }) =>
                a.effectiveDate
            )
            .map((a: Amendment) => ({
              ...a,
              // Convert ISO date to YYYY-MM-DD format for URL routing
              effectiveDate: a.effectiveDate.split('T')[0],
            }))
          setAmendments(validAmendments)
        }
      } catch (error) {
        console.error('Failed to fetch law history:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [lawSfs])

  const handleVersionSelect = (date: string) => {
    setOpen(false)
    router.push(`/lagar/${lawSlug}/version/${date}`)
  }

  const handleCurrentVersion = () => {
    setOpen(false)
    router.push(`/lagar/${lawSlug}`)
  }

  const handleShowAll = () => {
    setOpen(false)
    router.push(`/lagar/${lawSlug}/historik`)
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0]
      setOpen(false)
      setShowCalendar(false)
      router.push(`/lagar/${lawSlug}/version/${dateStr}`)
    }
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Format SFS number (remove "SFS " prefix if present)
  const formatSfs = (sfs: string) => {
    return sfs.replace(/^SFS\s*/i, '')
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Laddar...
      </Button>
    )
  }

  // Don't show if no amendments
  if (amendments.length === 0) {
    return null
  }

  // Get display text for button
  const buttonText = currentDate ? formatDate(currentDate) : 'Välj version'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('justify-start gap-2', className)}
        >
          <CalendarIcon className="h-4 w-4" />
          <span>{buttonText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {showCalendar ? (
          <div className="p-2">
            <div className="flex items-center justify-between mb-2 px-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCalendar(false)}
              >
                ← Tillbaka
              </Button>
              <span className="text-sm font-medium">Välj datum</span>
            </div>
            <Calendar
              mode="single"
              selected={currentDate ? new Date(currentDate) : undefined}
              onSelect={handleCalendarSelect}
              locale={sv}
              initialFocus
            />
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Current version option */}
            <button
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors border-b',
                !currentDate && 'bg-primary/5'
              )}
              onClick={handleCurrentVersion}
            >
              <div className="flex-1">
                <div className="font-medium">Gällande version</div>
                <div className="text-xs text-muted-foreground">
                  Nuvarande konsoliderade text
                </div>
              </div>
              {!currentDate && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Aktiv
                </span>
              )}
            </button>

            {/* Recent versions */}
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tidigare versioner
              </div>
              <div className="max-h-64 overflow-y-auto">
                {amendments.slice(0, 8).map((amendment) => (
                  <button
                    key={amendment.sfsNumber}
                    className={cn(
                      'flex items-center w-full gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors',
                      currentDate === amendment.effectiveDate && 'bg-primary/5'
                    )}
                    onClick={() => handleVersionSelect(amendment.effectiveDate)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {formatDate(amendment.effectiveDate)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatSfs(amendment.sfsNumber)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t p-2 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setShowCalendar(true)}
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                Välj datum
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={handleShowAll}
              >
                <History className="h-4 w-4 mr-1" />
                Alla ({amendments.length})
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

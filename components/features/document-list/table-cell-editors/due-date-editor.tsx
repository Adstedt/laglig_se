'use client'

/**
 * Story 4.12: Inline Due Date Editor for Table View
 */

import { useState } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Calendar as CalendarIcon, X, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DueDateEditorProps {
  value: Date | null
  onChange: (value: Date | null) => Promise<void>
}

export function DueDateEditor({ value, onChange }: DueDateEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleSelect = async (date: Date | undefined) => {
    setIsLoading(true)
    try {
      await onChange(date ?? null)
      setOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLoading(true)
    try {
      await onChange(null)
    } finally {
      setIsLoading(false)
    }
  }

  const isOverdue = value && isPast(value) && !isToday(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-8 justify-start text-left font-normal px-2',
            !value && 'text-muted-foreground',
            isOverdue && 'text-destructive'
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : value ? (
            <div className="flex items-center gap-1">
              {isOverdue && <AlertTriangle className="h-3 w-3" />}
              <span>{format(value, 'd MMM yyyy', { locale: sv })}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted cursor-pointer"
                aria-label="Rensa deadline"
              >
                <X className="h-3 w-3" />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              <span>—</span>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={handleSelect}
          locale={sv}
          initialFocus
        />
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive"
              onClick={handleClear}
            >
              <X className="mr-2 h-4 w-4" />
              Rensa deadline
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

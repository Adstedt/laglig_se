'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface DatePickerProps {
  value: Date | null
  onChange: (_date: Date | null) => void
  placeholder?: string | undefined
  id?: string | undefined
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  ariaDescribedBy?: string | undefined
  clearable?: boolean | undefined
  align?: 'start' | 'center' | 'end' | undefined
  className?: string | undefined
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Välj datum',
  id,
  disabled,
  invalid,
  ariaDescribedBy,
  clearable = true,
  align = 'start',
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            invalid && 'border-destructive focus-visible:ring-destructive',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
          {value ? format(value, 'd MMMM yyyy', { locale: sv }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            onChange(date ?? null)
            setOpen(false)
          }}
          locale={sv}
          initialFocus
        />
        {clearable && value && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Rensa datum
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function parseISODate(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null
}

export function toISODate(d: Date | null): string {
  return d ? format(d, 'yyyy-MM-dd') : ''
}

'use client'

/**
 * Story 6.19: Inline Task Status (Column) Editor
 * Select dropdown to change task column/status in table view
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskStatusOption {
  id: string
  name: string
  color: string
}

interface TaskStatusEditorProps {
  value: string
  columns: TaskStatusOption[]
  onChange: (_columnId: string) => Promise<void>
}

export function TaskStatusEditor({
  value,
  columns,
  onChange,
}: TaskStatusEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const currentColumn = columns.find((col) => col.id === value)

  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    setIsLoading(true)
    try {
      await onChange(newValue)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isLoading}>
      <SelectTrigger
        className={cn(
          'h-8 w-auto border-0 bg-transparent hover:bg-muted/50 focus:ring-0',
          isLoading && 'opacity-50'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
            style={{
              backgroundColor: `${currentColumn?.color}1A`,
              color: currentColumn?.color,
            }}
          >
            {currentColumn?.name}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        {columns.map((col) => (
          <SelectItem key={col.id} value={col.id}>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${col.color}1A`,
                color: col.color,
              }}
            >
              {col.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

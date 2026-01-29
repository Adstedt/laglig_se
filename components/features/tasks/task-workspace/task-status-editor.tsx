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
import { Badge } from '@/components/ui/badge'
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
          <Badge
            variant="outline"
            className="font-medium whitespace-nowrap"
            style={{
              borderColor: currentColumn?.color,
              backgroundColor: `${currentColumn?.color}15`,
              color: currentColumn?.color,
            }}
          >
            {currentColumn?.name}
          </Badge>
        )}
      </SelectTrigger>
      <SelectContent>
        {columns.map((col) => (
          <SelectItem key={col.id} value={col.id}>
            <Badge
              variant="outline"
              className="font-medium"
              style={{
                borderColor: col.color,
                backgroundColor: `${col.color}15`,
                color: col.color,
              }}
            >
              {col.name}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

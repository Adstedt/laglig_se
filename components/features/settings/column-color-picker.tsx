'use client'

/**
 * Story 6.5: Column Color Picker
 * Popover with preset colors and custom hex input for column colors.
 */

import { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const COLUMN_COLORS = [
  { name: 'Grå', value: '#6b7280' },
  { name: 'Blå', value: '#3b82f6' },
  { name: 'Grön', value: '#10b981' },
  { name: 'Gul', value: '#f59e0b' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Röd', value: '#ef4444' },
  { name: 'Lila', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
] as const

interface ColumnColorPickerProps {
  color: string
  onColorChange: (_color: string) => void
  disabled?: boolean
}

export function ColumnColorPicker({
  color,
  onColorChange,
  disabled = false,
}: ColumnColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [customColor, setCustomColor] = useState(color)

  const handlePresetClick = (presetColor: string) => {
    onColorChange(presetColor)
    setCustomColor(presetColor)
    setOpen(false)
  }

  const handleCustomColorChange = (value: string) => {
    setCustomColor(value)
    // Only update if valid hex
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      onColorChange(value)
    }
  }

  const handleCustomColorBlur = () => {
    // Reset to current color if invalid
    if (!/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      setCustomColor(color)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={disabled}
          aria-label="Välj färg"
        >
          <div
            className="h-4 w-4 rounded-full border border-border"
            style={{ backgroundColor: color }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="start">
        <div className="space-y-3">
          <Label className="text-xs font-medium">Färg</Label>

          {/* Preset colors grid */}
          <div className="grid grid-cols-4 gap-2">
            {COLUMN_COLORS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-all hover:scale-110',
                  color === preset.value
                    ? 'border-foreground ring-2 ring-foreground ring-offset-2'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: preset.value }}
                onClick={() => handlePresetClick(preset.value)}
                title={preset.name}
                aria-label={`Välj ${preset.name}`}
              />
            ))}
          </div>

          {/* Custom hex input */}
          <div className="space-y-1.5">
            <Label
              htmlFor="custom-color"
              className="text-xs text-muted-foreground"
            >
              Anpassad färg
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="custom-color"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                onBlur={handleCustomColorBlur}
                placeholder="#6b7280"
                className="h-8 font-mono text-xs"
                maxLength={7}
              />
              <div
                className="h-8 w-8 shrink-0 rounded border border-border"
                style={{
                  backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(customColor)
                    ? customColor
                    : color,
                }}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

'use client'

/**
 * Story 7.7 (AC 1): employee context picker for the chat input.
 *
 * A small toolbar button (next to the attach button) that opens a searchable
 * popover of the workspace's employees. Selecting one hands a
 * `ChatEmployeeOption` to the parent, which renders it as a removable pill
 * (attachment-chip pattern) and threads the id onto every send.
 *
 * Capability-gated: renders NOTHING unless the role holds `employees:view`
 * (fail-closed via usePermissions — loading/error deny). The server re-gates
 * both the list fetch (`getEmployeesForChatContext`) and the chat route's
 * employee ingestion, so this gate is UX, not security.
 */

import { useCallback, useState } from 'react'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/lib/hooks/use-permissions'
import {
  getEmployeesForChatContext,
  type ChatContextEmployee,
} from '@/app/actions/employees'
import { PERSONEL_TYPE_LABELS } from '@/lib/employees/labels'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** The compact shape the pill + transport need (id rides the chat body). */
export interface ChatEmployeeOption {
  id: string
  name: string
  /** Swedish personaltyp label ("Tjänsteman"/"Arbetare") or null when unset. */
  personelTypeLabel: string | null
  inactive: boolean
}

function toOption(e: ChatContextEmployee): ChatEmployeeOption {
  return {
    id: e.id,
    name: `${e.first_name} ${e.last_name}`.trim(),
    personelTypeLabel: e.personel_type
      ? PERSONEL_TYPE_LABELS[e.personel_type]
      : null,
    inactive: e.inactive,
  }
}

interface EmployeeContextPickerProps {
  onSelect: (_employee: ChatEmployeeOption) => void
  disabled?: boolean
  isExpanded?: boolean
}

export function EmployeeContextPicker({
  onSelect,
  disabled = false,
  isExpanded = false,
}: EmployeeContextPickerProps) {
  const { can } = usePermissions()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ChatEmployeeOption[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Lazy fetch on first open (and refetch after a failed attempt).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && (options === null || loadError)) {
        setLoadError(false)
        getEmployeesForChatContext()
          .then((res) => {
            if (res.success && res.data) {
              setOptions(res.data.map(toOption))
            } else {
              setLoadError(true)
            }
          })
          .catch(() => setLoadError(true))
      }
    },
    [options, loadError]
  )

  // Fail closed: no `employees:view` (or still loading) → no picker at all.
  if (!can.viewEmployees) return null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  'rounded-lg transition-all duration-150',
                  'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  isExpanded ? 'p-2' : 'p-1.5'
                )}
                aria-label="Fråga om en anställd"
                data-testid="chat-employee-picker-trigger"
              >
                <UserRound className={isExpanded ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Fråga om en anställd</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-72 p-0" align="start" side="top">
        <Command>
          <CommandInput placeholder="Sök anställd..." />
          <CommandList>
            <CommandEmpty>
              {loadError
                ? 'Kunde inte hämta anställda.'
                : options === null
                  ? 'Hämtar anställda…'
                  : 'Inga anställda hittades.'}
            </CommandEmpty>
            {(options ?? []).map((option) => (
              <CommandItem
                key={option.id}
                value={`${option.name} ${option.personelTypeLabel ?? ''}`}
                onSelect={() => {
                  onSelect(option)
                  setOpen(false)
                }}
              >
                <span className="truncate">{option.name}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {option.personelTypeLabel && (
                    <span>{option.personelTypeLabel}</span>
                  )}
                  {option.inactive && <span>· Inaktiv</span>}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

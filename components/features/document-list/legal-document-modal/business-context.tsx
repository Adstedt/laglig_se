'use client'

/**
 * Story 6.3: Business Context
 * Auto-saving textarea for describing how a law affects the business
 */

import { useState, useCallback } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { Textarea } from '@/components/ui/textarea'
import { updateListItemBusinessContext } from '@/app/actions/legal-document-modal'
import { toast } from 'sonner'
import { Loader2, Check } from 'lucide-react'

interface BusinessContextProps {
  listItemId: string
  initialContent: string | null
}

export function BusinessContext({
  listItemId,
  initialContent,
}: BusinessContextProps) {
  const [content, setContent] = useState(initialContent ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  )

  const debouncedSave = useDebouncedCallback(async (value: string) => {
    setSaveStatus('saving')
    try {
      const result = await updateListItemBusinessContext(listItemId, value)
      if (!result.success) {
        throw new Error(result.error ?? 'Kunde inte spara')
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      toast.error('Kunde inte spara', {
        description:
          error instanceof Error ? error.message : 'Försök igen senare',
      })
      setSaveStatus('idle')
    }
  }, 1000)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value)
      debouncedSave(e.target.value)
    },
    [debouncedSave]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-foreground">
          Hur påverkar denna lag oss?
        </span>
        {saveStatus === 'saving' && (
          <span className="text-xs text-muted-foreground flex items-center">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Sparar...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-xs text-green-600 flex items-center">
            <Check className="h-3 w-3 mr-1" />
            Sparat
          </span>
        )}
      </div>

      <Textarea
        value={content}
        onChange={handleChange}
        placeholder="Beskriv hur denna lag påverkar er verksamhet..."
        className="min-h-[100px] resize-y"
      />

      <p className="text-xs text-muted-foreground">
        Stödjer Markdown-formatering
      </p>
    </div>
  )
}

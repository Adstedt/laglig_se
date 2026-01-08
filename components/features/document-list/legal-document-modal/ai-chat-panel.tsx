'use client'

/**
 * Story 6.3: AI Chat Panel
 * In-modal AI chat flyout panel
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, Send, X } from 'lucide-react'

interface AiChatPanelProps {
  documentTitle: string
  documentNumber: string
  onClose: () => void
}

export function AiChatPanel({
  documentTitle,
  documentNumber: _documentNumber,
  onClose,
}: AiChatPanelProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement AI chat in future story
    setInput('')
  }

  return (
    <div className="flex flex-col h-full w-full bg-background border-t border-r border-b rounded-r-lg">
      {/* Header - matches modal header styling */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0 bg-background">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Assistent</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Stäng AI Chat</span>
        </Button>
      </div>

      {/* Chat messages area */}
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium">Ställ en fråga om lagen</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
            AI:n kan hjälpa dig förstå {documentTitle}
          </p>
        </div>
      </ScrollArea>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t p-3 shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Skriv din fråga..."
            className="min-h-[60px] max-h-[120px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            size="sm"
            className="h-auto px-3"
            disabled={!input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Tryck Enter för att skicka
        </p>
      </form>
    </div>
  )
}

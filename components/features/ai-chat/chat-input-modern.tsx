'use client'

/**
 * Modern Chat Input Component
 * ChatGPT-style input with attach, model selector, and quick action chips
 * Polished design with better contrast and spacing
 */

import {
  useState,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react'
import {
  Send,
  Loader2,
  Paperclip,
  ChevronDown,
  FileText,
  Scale,
  Lightbulb,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const MAX_MESSAGE_LENGTH = 2000
const SHOW_COUNTER_THRESHOLD = 1500

// Quick action chips for legal context
const QUICK_ACTIONS = [
  {
    id: 'summarize',
    label: 'Sammanfatta',
    icon: FileText,
    prompt: 'Sammanfatta det viktigaste i ',
  },
  {
    id: 'explain',
    label: 'Förklara',
    icon: Lightbulb,
    prompt: 'Förklara på ett enkelt sätt ',
  },
  {
    id: 'compare',
    label: 'Jämför',
    icon: Scale,
    prompt: 'Jämför följande lagar: ',
  },
  {
    id: 'checklist',
    label: 'Checklista',
    icon: ListChecks,
    prompt: 'Skapa en checklista för ',
  },
]

// Available models (for display - actual selection is server-side)
interface ModelOption {
  id: string
  label: string
  provider: string
}

const MODELS: ModelOption[] = [
  { id: 'claude', label: 'Claude 3.5', provider: 'Anthropic' },
  { id: 'gpt4', label: 'GPT-4', provider: 'OpenAI' },
]

const DEFAULT_MODEL: ModelOption = MODELS[0]!

interface ChatInputModernProps {
  onSend: (_message: string) => void
  onAttach?: () => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  className?: string
  showModelSelector?: boolean
  showAttach?: boolean
  showQuickActions?: boolean
  isExpanded?: boolean
}

export const ChatInputModern = forwardRef<
  HTMLTextAreaElement,
  ChatInputModernProps
>(function ChatInputModern(
  {
    onSend,
    onAttach,
    disabled = false,
    isLoading = false,
    placeholder = 'Fråga vad som helst...',
    className,
    showModelSelector = true,
    showAttach = true,
    showQuickActions = true,
    isExpanded = false,
  },
  ref
) {
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [mounted, setMounted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Prevent hydration mismatch with DropdownMenu
  useEffect(() => {
    setMounted(true)
  }, [])

  // Forward ref to textarea
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

  const trimmedInput = input.trim()
  const isOverLimit = input.length > MAX_MESSAGE_LENGTH
  const showCounter = input.length > SHOW_COUNTER_THRESHOLD
  const canSend =
    trimmedInput.length > 0 && !isOverLimit && !disabled && !isLoading

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend) return

    onSend(trimmedInput)
    setInput('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '52px'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) {
        onSend(trimmedInput)
        setInput('')
        if (textareaRef.current) {
          textareaRef.current.style.height = '52px'
        }
      }
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setInput(textarea.value)

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set height to scrollHeight, max 200px
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 52), 200)}px`
  }

  const handleQuickAction = (prompt: string) => {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'border-t bg-card',
        isExpanded ? 'px-6 py-5' : 'px-4 py-4',
        className
      )}
    >
      {/* Quick action chips */}
      {showQuickActions && (
        <div className={cn('flex flex-wrap gap-2 mb-4', isExpanded && 'gap-3')}>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.prompt)}
              disabled={disabled || isLoading}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg',
                'border border-border bg-background',
                'hover:bg-muted hover:border-border',
                'active:scale-[0.98]',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isExpanded ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
              )}
            >
              <action.icon
                className={cn(
                  'text-muted-foreground',
                  isExpanded ? 'h-4 w-4' : 'h-3.5 w-3.5'
                )}
              />
              <span className="font-medium text-foreground/80">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            'relative flex flex-col rounded-xl',
            'border border-border bg-background',
            'shadow-sm',
            'focus-within:border-primary/50 focus-within:shadow-md',
            'transition-all duration-200',
            isOverLimit &&
              'border-destructive/50 focus-within:border-destructive',
            (disabled || isLoading) && 'opacity-60'
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'w-full bg-transparent resize-none',
              'text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none',
              isExpanded
                ? 'px-5 pt-4 pb-3 text-base min-h-[52px] max-h-[200px]'
                : 'px-4 pt-4 pb-3 text-sm min-h-[52px] max-h-[160px]'
            )}
            style={{ height: '52px' }}
            disabled={disabled || isLoading}
            maxLength={MAX_MESSAGE_LENGTH + 100}
            aria-label="Meddelande till AI"
            data-testid="chat-input"
            rows={1}
          />

          {/* Bottom toolbar */}
          <div
            className={cn(
              'flex items-center justify-between border-t border-border/30',
              isExpanded ? 'px-4 py-3' : 'px-3 py-2.5'
            )}
          >
            <div className="flex items-center gap-1">
              {/* Attach button */}
              {showAttach && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onAttach}
                        disabled={disabled || isLoading || !onAttach}
                        className={cn(
                          'rounded-lg transition-all duration-150',
                          'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          isExpanded ? 'p-2' : 'p-1.5'
                        )}
                        aria-label="Bifoga fil"
                      >
                        <Paperclip
                          className={isExpanded ? 'h-4 w-4' : 'h-3.5 w-3.5'}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Bifoga fil (kommer snart)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Model selector - only render after mount to prevent hydration mismatch */}
              {showModelSelector && mounted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={disabled || isLoading}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg',
                        'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
                        'transition-all duration-150',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                        isExpanded
                          ? 'px-2.5 py-1.5 text-sm'
                          : 'px-2 py-1 text-xs'
                      )}
                    >
                      <span className="font-medium">{selectedModel.label}</span>
                      <ChevronDown
                        className={isExpanded ? 'h-3.5 w-3.5' : 'h-3 w-3'}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    {MODELS.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => setSelectedModel(model)}
                        className="flex items-center justify-between py-2.5"
                      >
                        <span className="font-medium">{model.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.provider}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Character counter */}
              {showCounter && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    isOverLimit
                      ? 'text-destructive'
                      : 'text-muted-foreground/60'
                  )}
                >
                  {input.length}/{MAX_MESSAGE_LENGTH}
                </span>
              )}

              {/* Send button */}
              <button
                type="submit"
                disabled={!canSend}
                className={cn(
                  'flex items-center justify-center rounded-lg transition-all duration-150',
                  'active:scale-95',
                  canSend
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                    : 'bg-muted text-muted-foreground/50 cursor-not-allowed',
                  isExpanded ? 'h-10 w-10' : 'h-8 w-8'
                )}
                aria-label="Skicka meddelande"
                data-testid="chat-send-button"
              >
                {isLoading ? (
                  <Loader2
                    className={cn(
                      'animate-spin',
                      isExpanded ? 'h-5 w-5' : 'h-4 w-4'
                    )}
                  />
                ) : (
                  <Send className={isExpanded ? 'h-5 w-5' : 'h-4 w-4'} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard hint */}
        <p
          className={cn(
            'text-muted-foreground/40 mt-2.5 px-1 text-center',
            isExpanded ? 'text-xs' : 'text-[10px]'
          )}
        >
          <kbd className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground/70 font-mono text-[9px]">
            Enter
          </kbd>
          <span className="mx-1.5">för att skicka</span>
          <span className="text-muted-foreground/30">·</span>
          <kbd className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground/70 font-mono text-[9px] ml-1.5">
            Shift+Enter
          </kbd>
          <span className="ml-1.5">för ny rad</span>
        </p>
      </form>
    </div>
  )
})

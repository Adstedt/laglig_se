'use client'

/**
 * Chat Message Component
 * Renders individual chat messages with modern styling, markdown support, and actions
 */

import type { UIMessage } from 'ai'
import { User } from 'lucide-react'
import { CitationTooltip } from './citation-tooltip'
import { MessageActions } from './message-actions'
import { parseCitations, type Citation } from '@/lib/ai/citations'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface ChatMessageProps {
  message: UIMessage
  citations?: Citation[]
  showActions?: boolean
}

export function ChatMessage({
  message,
  citations = [],
  showActions = true,
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const textParts = message.parts?.filter((part) => part.type === 'text') ?? []

  // Get full text content for copy functionality
  const fullTextContent = textParts
    .map((part) => ('text' in part ? part.text : ''))
    .join('\n')

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted border border-border'
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">
            AI
          </span>
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'flex-1 overflow-hidden',
          isUser ? 'text-right' : 'text-left'
        )}
      >
        <div className="space-y-2">
          {textParts.map((part, index) => {
            if (part.type !== 'text') return null

            if (isUser) {
              return (
                <div
                  key={`${message.id}-${index}`}
                  className="inline-block rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                >
                  <p className="whitespace-pre-wrap">{part.text}</p>
                </div>
              )
            }

            return (
              <MessageTextWithCitations
                key={`${message.id}-${index}`}
                text={part.text}
                citations={citations}
              />
            )
          })}
        </div>

        {/* Actions for AI messages */}
        {!isUser && showActions && fullTextContent && (
          <MessageActions messageId={message.id} content={fullTextContent} />
        )}
      </div>
    </div>
  )
}

interface MessageTextWithCitationsProps {
  text: string
  citations: Citation[]
}

function MessageTextWithCitations({
  text,
  citations,
}: MessageTextWithCitationsProps) {
  const { segments } = parseCitations(text)

  return (
    <div className="text-sm">
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <span
              key={index}
              className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-ul:my-2 prose-li:my-0.5 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none"
            >
              <ReactMarkdown
                components={{
                  // Ensure links open in new tab
                  a: ({ children, href, ...props }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                  // Style code blocks
                  code: ({ children, className, ...props }) => {
                    const isBlock = className?.includes('language-')
                    if (isBlock) {
                      return (
                        <code
                          className="block bg-muted p-3 rounded-lg text-xs overflow-x-auto"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code
                        className="bg-muted px-1 py-0.5 rounded text-xs"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  // Properly style lists
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 my-2 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 my-2 space-y-1">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                  // Style paragraphs
                  p: ({ children }) => (
                    <p className="my-2 leading-relaxed">{children}</p>
                  ),
                  // Style headings
                  h1: ({ children }) => (
                    <h1 className="text-lg font-semibold mt-4 mb-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold mt-4 mb-2">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mt-3 mb-1">
                      {children}
                    </h3>
                  ),
                  // Style blockquotes
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-muted-foreground italic">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {segment.content}
              </ReactMarkdown>
            </span>
          )
        }

        // Citation marker
        const citationIndex = parseInt(segment.content, 10) - 1
        const citation = citations[citationIndex]

        if (!citation) {
          return (
            <span key={index} className="text-primary font-medium">
              [{segment.content}]
            </span>
          )
        }

        return (
          <CitationTooltip key={index} citation={citation}>
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-[10px] font-medium rounded-md bg-muted border border-border text-muted-foreground cursor-help hover:bg-muted/80 hover:text-foreground transition-colors">
              {segment.content}
            </span>
          </CitationTooltip>
        )
      })}
    </div>
  )
}

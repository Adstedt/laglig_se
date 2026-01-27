'use client'

/**
 * AI Elements: Response Component
 * Renders AI response text with markdown support
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface ResponseProps {
  children: string
  className?: string
}

export function Response({ children, className }: ResponseProps) {
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none', className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom link styling
          a: ({
            className: linkClassName,
            children: linkChildren,
            ...props
          }) => (
            <a
              className={cn(
                'text-primary underline underline-offset-4 hover:text-primary/80',
                linkClassName
              )}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {linkChildren}
            </a>
          ),
          // Custom code block styling
          code: ({
            className: codeClassName,
            children: codeChildren,
            ...props
          }) => {
            const isInline = !codeClassName?.includes('language-')
            if (isInline) {
              return (
                <code
                  className={cn(
                    'rounded bg-muted px-1 py-0.5 font-mono text-xs',
                    codeClassName
                  )}
                  {...props}
                >
                  {codeChildren}
                </code>
              )
            }
            return (
              <code className={cn('block', codeClassName)} {...props}>
                {codeChildren}
              </code>
            )
          },
          // Custom paragraph styling
          p: ({ className: pClassName, ...props }) => (
            <p
              className={cn(
                'leading-relaxed [&:not(:first-child)]:mt-2',
                pClassName
              )}
              {...props}
            />
          ),
          // Custom list styling
          ul: ({ className: ulClassName, ...props }) => (
            <ul className={cn('my-2 ml-4 list-disc', ulClassName)} {...props} />
          ),
          ol: ({ className: olClassName, ...props }) => (
            <ol
              className={cn('my-2 ml-4 list-decimal', olClassName)}
              {...props}
            />
          ),
          li: ({ className: liClassName, ...props }) => (
            <li className={cn('mt-1', liClassName)} {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

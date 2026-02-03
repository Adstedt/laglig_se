'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface LogViewerProps {
  content: string | null
}

function parseLogLine(line: string): {
  timestamp: string | null
  message: string
} {
  const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]\s*(.*)$/)
  if (match?.[1] && match?.[2] !== undefined) {
    return { timestamp: match[1], message: match[2] }
  }
  return { timestamp: null, message: line }
}

function isErrorLine(line: string): boolean {
  return /error|fail/i.test(line)
}

export function LogViewer({ content }: LogViewerProps) {
  const [copied, setCopied] = useState(false)

  if (!content) {
    return (
      <div className="rounded-lg bg-gray-900 p-4 text-sm text-gray-400">
        Ingen loggdata
      </div>
    )
  }

  const lines = content.split('\n')

  async function handleCopy() {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3" />
              Kopierat!
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" />
              Kopiera
            </>
          )}
        </Button>
      </div>
      <div className="max-h-[600px] overflow-y-auto rounded-lg bg-gray-900 p-4 font-mono text-xs text-gray-100">
        {lines.map((line, i) => {
          if (line === '' && i === lines.length - 1) return null
          const parsed = parseLogLine(line)
          const error = isErrorLine(line)
          return (
            <div key={i} className={error ? 'text-red-400' : undefined}>
              {parsed.timestamp && (
                <span className="text-gray-500">[{parsed.timestamp}] </span>
              )}
              <span>{parsed.message}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

/**
 * Story 3.3: Citation Tooltip Component
 * Displays law reference details on hover
 */

import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ExternalLink } from 'lucide-react'
import type { Citation } from '@/lib/ai/citations'
import { track } from '@vercel/analytics'

interface CitationTooltipProps {
  citation: Citation
  children: React.ReactNode
}

export function CitationTooltip({ citation, children }: CitationTooltipProps) {
  const handleLinkClick = () => {
    track('ai_chat_citation_clicked', {
      lawId: citation.lawId,
      sfsNumber: citation.sfsNumber,
    })
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[280px] p-3"
          data-testid="citation-tooltip"
        >
          <div className="space-y-2">
            {/* Law title */}
            <p className="font-medium text-sm leading-tight">
              {citation.lawTitle}
            </p>

            {/* SFS number */}
            <p className="text-xs text-muted-foreground">
              {citation.sfsNumber}
            </p>

            {/* Snippet */}
            <p className="text-xs text-muted-foreground line-clamp-3">
              {citation.snippet}
            </p>

            {/* View law link */}
            <Link
              href={`/lagar/${citation.lawId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              onClick={handleLinkClick}
            >
              Visa lag
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

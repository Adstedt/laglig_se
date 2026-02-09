'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TemplateAdoptCtaProps {
  templateName: string
}

export function TemplateAdoptCta({ templateName }: TemplateAdoptCtaProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-2.5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{templateName}</span>
        <span className="hidden sm:inline"> — Malladoption lanseras snart</span>
      </p>
      <Button size="sm" className="gap-1.5 shrink-0" disabled>
        <Sparkles className="h-3.5 w-3.5" />
        Använd denna mall
      </Button>
    </div>
  )
}

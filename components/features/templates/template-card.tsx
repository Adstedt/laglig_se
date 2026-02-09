'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Layers } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'
import {
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  DEFAULT_DOMAIN_COLOR,
} from '@/lib/constants/template-domains'

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

interface TemplateCardProps {
  template: PublishedTemplate
}

export function TemplateCard({ template }: TemplateCardProps) {
  const [showVariant, setShowVariant] = useState(false)
  const hasVariants = template.variants.length > 0
  const variant = hasVariants ? template.variants[0] : null

  const activeSlug = showVariant && variant ? variant.slug : template.slug
  const activeDocCount =
    showVariant && variant ? variant.document_count : template.document_count
  const activeSectionCount =
    showVariant && variant ? variant.section_count : template.section_count

  const domainLabel = DOMAIN_LABELS[template.domain] ?? template.domain
  const domainColor = DOMAIN_COLORS[template.domain] ?? DEFAULT_DOMAIN_COLOR

  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <Link
        href={`/laglistor/mallar/${activeSlug}`}
        className="flex flex-1 flex-col"
      >
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg leading-tight">
              {template.name}
            </CardTitle>
            <Badge
              variant="outline"
              className={`text-xs py-0 px-1.5 shrink-0 ${domainColor}`}
            >
              {domainLabel}
            </Badge>
          </div>
          {template.target_audience && (
            <Badge variant="outline" className="text-xs py-0 px-1.5 w-fit">
              {template.target_audience}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          {template.description && (
            <p className="text-sm text-muted-foreground">
              {truncate(template.description, 120)}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span data-testid="document-count">{activeDocCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              <span data-testid="section-count">{activeSectionCount}</span>
            </span>
          </div>

          {template.primary_regulatory_bodies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.primary_regulatory_bodies.map((body) => (
                <Badge
                  key={body}
                  variant="secondary"
                  className="text-xs py-0 px-1.5"
                >
                  {body}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Link>

      {hasVariants && variant && (
        <CardFooter className="border-t pt-4">
          <div className="flex items-center gap-2">
            <Switch
              id={`variant-toggle-${template.id}`}
              checked={showVariant}
              onCheckedChange={setShowVariant}
            />
            <Label
              htmlFor={`variant-toggle-${template.id}`}
              className="text-sm cursor-pointer"
            >
              Visa tjänsteföretagsversion
            </Label>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

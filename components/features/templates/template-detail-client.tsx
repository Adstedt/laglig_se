'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TemplateDetailHeader } from '@/components/features/templates/template-detail-header'
import { TemplateSectionsAccordion } from '@/components/features/templates/template-sections-accordion'
import { TemplateAdoptCta } from '@/components/features/templates/template-adopt-cta'
import type { TemplateDetail } from '@/lib/db/queries/template-catalog'

interface TemplateDetailClientProps {
  template: TemplateDetail
}

export function TemplateDetailClient({ template }: TemplateDetailClientProps) {
  const router = useRouter()
  const hasVariants = !template.is_variant && template.variants.length > 0
  const variant = hasVariants ? template.variants[0] : null
  const isVariant = template.is_variant && !!template.parent_slug

  return (
    <div className="space-y-6">
      {/* Parent link for variant templates */}
      {isVariant && (
        <Link
          href={`/laglistor/mallar/${template.parent_slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Visa fullständig version
        </Link>
      )}

      <TemplateDetailHeader template={template} />

      {/* Toolbar row: variant toggle + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Variant toggle for parent templates */}
        {hasVariants && variant ? (
          <div className="flex items-center gap-2">
            <Switch
              id="variant-toggle"
              checked={false}
              onCheckedChange={() => {
                router.push(`/laglistor/mallar/${variant.slug}`)
              }}
            />
            <Label htmlFor="variant-toggle" className="text-sm cursor-pointer">
              Visa version för tjänsteföretag
            </Label>
          </div>
        ) : (
          <div />
        )}

        <TemplateAdoptCta templateName={template.name} />
      </div>

      <TemplateSectionsAccordion sections={template.sections} />
    </div>
  )
}

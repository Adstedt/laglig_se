'use client'

import { useState } from 'react'
import { Library, Users } from 'lucide-react'
import Link from 'next/link'
import { TemplateCard } from '@/components/features/templates/template-card'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'
import { DOMAIN_LABELS } from '@/lib/constants/template-domains'
import { cn } from '@/lib/utils'

type TemplateSource = 'official' | 'community'

interface TemplateCatalogClientProps {
  templates: PublishedTemplate[]
  domains: string[]
}

export function TemplateCatalogClient({
  templates,
  domains,
}: TemplateCatalogClientProps) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<TemplateSource>('official')

  const filteredTemplates = activeDomain
    ? templates.filter((t) => t.domain === activeDomain)
    : templates

  // Full empty state — no published templates at all
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Library className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-semibold">Inga mallar just nu</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Mallar publiceras inom kort — kom tillbaka snart!
        </p>
        <Link
          href="/laglistor"
          className="mt-4 text-sm text-primary hover:underline"
        >
          Tillbaka till laglistor
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Source toggle */}
      <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
        <button
          onClick={() => setActiveSource('official')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeSource === 'official'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Laglig standardmallar
        </button>
        <button
          onClick={() => setActiveSource('community')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeSource === 'community'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Community
        </button>
      </div>

      {activeSource === 'community' ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold">
            Community-mallar kommer snart
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Här kommer du kunna hitta och dela laglistor skapade av andra
            företag och compliance-experter.
          </p>
        </div>
      ) : (
        <>
          {/* Domain filter */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveDomain(null)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-colors',
                activeDomain === null
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border text-foreground'
              )}
            >
              Alla
            </button>
            {domains.map((domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => setActiveDomain(domain)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  activeDomain === domain
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border text-foreground'
                )}
              >
                {DOMAIN_LABELS[domain] ?? domain}
              </button>
            ))}
          </div>

          {/* Card grid or per-domain empty state */}
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Inga mallar för detta område ännu — kommer snart
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

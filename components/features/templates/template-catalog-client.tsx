'use client'

import { useState } from 'react'
import { Library, Users } from 'lucide-react'
import Link from 'next/link'
import { TemplateCard } from '@/components/features/templates/template-card'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'
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
      <EmptyState
        icon={<Library className="h-12 w-12 text-muted-foreground/50" />}
        title="Inga mallar just nu"
        description="Mallar publiceras inom kort — kom tillbaka snart!"
        action={
          <Link
            href="/laglistor"
            className="text-sm text-primary hover:underline"
          >
            Tillbaka till laglistor
          </Link>
        }
      />
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
        <EmptyState
          icon={<Users className="h-12 w-12 text-muted-foreground/50" />}
          title="Community-mallar kommer snart"
          description="Här kommer du kunna hitta och dela laglistor skapade av andra företag och compliance-experter."
        />
      ) : (
        <>
          {/* Domain filter */}
          <FilterChipGroup aria-label="Filtrera mallar efter område">
            <FilterChip
              pressed={activeDomain === null}
              onPressedChange={() => setActiveDomain(null)}
            >
              Alla
            </FilterChip>
            {domains.map((domain) => (
              <FilterChip
                key={domain}
                pressed={activeDomain === domain}
                onPressedChange={() => setActiveDomain(domain)}
              >
                {DOMAIN_LABELS[domain] ?? domain}
              </FilterChip>
            ))}
          </FilterChipGroup>

          {/* Card grid or per-domain empty state */}
          {filteredTemplates.length === 0 ? (
            <EmptyState description="Inga mallar för detta område ännu — kommer snart" />
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

'use client'

/**
 * Story 12.10b Task 3: Chooser step — two option cards + popular templates.
 */

import { Library, Plus } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { TemplateOptionCard } from './template-option-card'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

interface CreateListChooserProps {
  templates: PublishedTemplate[]
  onSelectTemplate: (_template: PublishedTemplate) => void
  onSelectBlank: () => void
}

export function CreateListChooser({
  templates,
  onSelectTemplate,
  onSelectBlank,
}: CreateListChooserProps) {
  function handleCardKeyDown(e: React.KeyboardEvent, action: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  // "Börja från mall" scrolls to the template section or selects the first template
  function handleFromTemplate() {
    const section = document.getElementById('popular-templates-section')
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      // Focus the first template card
      const firstCard = section.querySelector<HTMLElement>('[role="button"]')
      firstCard?.focus()
    }
  }

  const displayTemplates = templates.slice(0, 4)

  return (
    <div className="flex flex-col gap-4">
      {/* Two option cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* "Börja från mall" — recommended */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleFromTemplate}
          onKeyDown={(e) => handleCardKeyDown(e, handleFromTemplate)}
          className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-card p-5 ring-2 ring-primary/10 hover:border-primary/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Library className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Börja från mall</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Välj bland expertframtagna laglistor med färdiga lagar och
              sammanfattningar
            </p>
          </div>
        </div>

        {/* "Tom lista" */}
        <div
          role="button"
          tabIndex={0}
          onClick={onSelectBlank}
          onKeyDown={(e) => handleCardKeyDown(e, onSelectBlank)}
          className="flex flex-col gap-3 rounded-lg border bg-card p-5 hover:border-primary/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Tom lista</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Skapa en helt egen laglista från grunden
            </p>
          </div>
        </div>
      </div>

      {/* Popular templates section */}
      {displayTemplates.length > 0 && (
        <div id="popular-templates-section">
          <Separator className="mb-3" />
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Populära mallar
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {displayTemplates.map((template) => (
              <TemplateOptionCard
                key={template.id}
                template={template}
                onClick={() => onSelectTemplate(template)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

/**
 * Story 12.10b Task 3: Chooser step — two option cards + tabbed templates.
 * Story 24.6: Added third "Importera" card alongside the existing two.
 */

import { Library, Plus, Upload } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TemplateOptionCard } from './template-option-card'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

// Story 24.6 AC 18: feature-flag for the Importera card. Default `true`;
// set to `false` only if upstream stories (24.2 / 24.3 / 24.4) regress.
const IMPORT_PATH_ENABLED = true

interface CreateListChooserProps {
  templates: PublishedTemplate[]
  onSelectTemplate: (_template: PublishedTemplate) => void
  onSelectBlank: () => void
  onSelectImport?: () => void
}

export function CreateListChooser({
  templates,
  onSelectTemplate,
  onSelectBlank,
  onSelectImport,
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
  const showImportCard = IMPORT_PATH_ENABLED && onSelectImport

  return (
    <div className="flex flex-col gap-4">
      {/* Option cards: 1 col on mobile, 2 col at sm, 3 col at lg (breathing room per AC 1). */}
      <div
        className={
          showImportCard
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-4'
        }
      >
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

        {/* "Importera" — Story 24.6 */}
        {showImportCard && (
          <div
            role="button"
            tabIndex={0}
            onClick={onSelectImport}
            onKeyDown={(e) => handleCardKeyDown(e, onSelectImport)}
            className="flex flex-col gap-3 rounded-lg border bg-card p-5 hover:border-primary/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Importera</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ladda upp en befintlig laglista från Excel, CSV eller klistra in
                raderna
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Template tabs section */}
      {displayTemplates.length > 0 && (
        <div id="popular-templates-section">
          <Separator className="mb-3" />
          <Tabs defaultValue="laglig">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="laglig">Laglig</TabsTrigger>
              <TabsTrigger value="community">Community</TabsTrigger>
            </TabsList>
            <TabsContent value="laglig">
              <div className="flex flex-col gap-2">
                {displayTemplates.map((template) => (
                  <TemplateOptionCard
                    key={template.id}
                    template={template}
                    onClick={() => onSelectTemplate(template)}
                  />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="community">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Kommer snart
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Community-mallar kommer att vara tillgängliga här i framtiden.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

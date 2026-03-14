'use client'

/**
 * Story 6.3: Activity Tabs
 * Tabbed activity section with Alla, Kommentarer, Uppgifter, Bevis, Historik
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityFeed } from './activity-feed'
import { CommentsTab } from './comments-tab'
import { TasksTab } from './tasks-tab'
import { EvidenceTab } from './evidence-tab'
import { HistoryTab } from './history-tab'

interface ActivityTabsProps {
  listItemId: string
  currentUserId?: string | undefined
}

export function ActivityTabs({ listItemId, currentUserId }: ActivityTabsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">Aktivitet</h3>

      <Tabs defaultValue="alla" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex gap-1 h-auto p-1 bg-muted/60">
          <TabsTrigger
            id="activity-tab-alla"
            value="alla"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Alla
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-kommentarer"
            value="kommentarer"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Kommentarer
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-uppgifter"
            value="uppgifter"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Uppgifter
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-bevis"
            value="bevis"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Bevis
          </TabsTrigger>
          <TabsTrigger
            id="activity-tab-historik"
            value="historik"
            className="whitespace-nowrap px-3 py-1.5 text-sm data-[state=active]:bg-background"
          >
            Historik
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="alla"
          className="mt-4 max-h-[400px] overflow-y-auto"
        >
          <ActivityFeed listItemId={listItemId} />
        </TabsContent>

        <TabsContent
          value="kommentarer"
          className="mt-4 max-h-[400px] overflow-y-auto"
        >
          <CommentsTab listItemId={listItemId} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent
          value="uppgifter"
          className="mt-4 max-h-[400px] overflow-y-auto"
        >
          <TasksTab listItemId={listItemId} />
        </TabsContent>

        <TabsContent
          value="bevis"
          className="mt-4 max-h-[400px] overflow-y-auto"
        >
          <EvidenceTab listItemId={listItemId} />
        </TabsContent>

        <TabsContent
          value="historik"
          className="mt-4 max-h-[400px] overflow-y-auto"
        >
          <HistoryTab listItemId={listItemId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
